<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { findTool } from '@/config/menu'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { getEffectivePrompts } from '@/services/prompts'
import { renderMarkdown } from '@/services/markdown'
import { callAi, AiError } from '@/services/ai'
import { getDemoResponse } from '@/services/demo'
import { getRecommendations } from '@/services/recommendations'
import { downloadProjectExport, serializeProjectExport } from '@/services/export'
import { syncProjectToConfluence, getJiraProjectIssues, getJiraIssueDetail, getActiveSprintWithIssues, AtlassianError } from '@/services/atlassian'
import type { JiraProjectIssue, ActiveSprintResult } from '@/services/atlassian'
import type { Requirement } from '@/types'
import {
    createIssueFromRequirementAdapter,
    JiraError,
    mapMoscowToPriority,
    mapTypeToIssueType,
} from '@/services/jira'
import AppIcon from './AppIcon.vue'
import PromptEditor from './PromptEditor.vue'

// Mermaid-Ansicht (inkl. Mermaid-Lib) erst bei Bedarf laden.
const MermaidView = defineAsyncComponent(() => import('./MermaidView.vue'))

const props = defineProps<{ toolId: string }>()

const store = useProjectStore()
const settings = useSettingsStore()
const { favorites } = storeToRefs(store)
const { show } = useToast()

const found = computed(() => findTool(props.toolId))
const tool = computed(() => found.value?.tool ?? null)

const variantKeys = computed(() => Object.keys(tool.value?.promptPatterns ?? {}))
const selectedVariant = ref<string | undefined>(undefined)

const input = ref('')
const result = ref('')
const loading = ref(false)

const isModeling = computed(() => props.toolId === 'modeling')
const isExportTool = computed(() => props.toolId === 'export_context')
const isBacklogTool = computed(() => props.toolId === 'backlog')
const isJiraHandoverTool = computed(() => props.toolId === 'jira_handover')
const isJiraDashboardTool = computed(() => props.toolId === 'jira_dashboard')
const isJiraQualityTool = computed(() => props.toolId === 'jira_quality')
const isFavorite = computed(() => favorites.value.includes(props.toolId))
const isDemoMode = computed(() => store.demoModeLoaded)
const recommendations = computed(() => getRecommendations(props.toolId, selectedVariant.value))
const exportPreview = computed(() => serializeProjectExport())
const backlogBusy = ref(false)
const backlogBusyId = ref<string | null>(null)

// Atlassian Jira/Confluence sync state
const jiraBusy = ref(false)
const jiraBusyId = ref<string | null>(null)
const confluenceBusy = ref(false)
const jiraDashboardBusy = ref(false)

// UC3: RE-Health Dashboard state
const dashboardIssues = ref<JiraProjectIssue[]>([])
const dashboardSprint = ref<ActiveSprintResult | null>(null)
const dashboardLoaded = ref(false)
const dashboardUpdatedAt = ref<string>('')
const STALE_DAYS = 14

/** Tage seit letzter Aktualisierung eines Issues. */
function daysSince(iso: string): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/** Zählt Vorkommen eines Feldes und liefert sortierte Verteilungsbalken. */
function distribution(
  issues: JiraProjectIssue[],
  key: (i: JiraProjectIssue) => string,
  limit = 8,
): { label: string; value: number; pct: number }[] {
  const counts = new Map<string, number>()
  for (const i of issues) {
    const k = key(i) || '—'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const total = issues.length || 1
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value, pct: Math.round((value / total) * 100) }))
}

/** Auslastung pro Bearbeiter inkl. Story-Points-Summe. */
function assigneeWorkload(
  issues: JiraProjectIssue[],
  limit = 6,
): { label: string; value: number; points: number; pct: number }[] {
  const map = new Map<string, { count: number; points: number }>()
  for (const i of issues) {
    const k = i.assignee || '—'
    const cur = map.get(k) ?? { count: 0, points: 0 }
    cur.count += 1
    cur.points += i.storyPoints ?? 0
    map.set(k, cur)
  }
  const total = issues.length || 1
  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([label, v]) => ({ label, value: v.count, points: v.points, pct: Math.round((v.count / total) * 100) }))
}

/** Kern-KPIs des Projekts. */
const dashboardKpis = computed(() => {
  const issues = dashboardIssues.value
  const total = issues.length
  const done = issues.filter((i) => i.statusCategory === 'done').length
  const inProgress = issues.filter((i) => i.statusCategory === 'indeterminate').length
  const todo = issues.filter((i) => i.statusCategory === 'new' || i.statusCategory === 'unknown').length
  const unassigned = issues.filter((i) => i.assignee === 'Unassigned').length
  const stale = issues.filter((i) => i.statusCategory !== 'done' && daysSince(i.updated) >= STALE_DAYS).length
  const highPrio = issues.filter((i) => /high|highest|critical|blocker|hoch/i.test(i.priority)).length
  return {
    total,
    done,
    inProgress,
    todo,
    unassigned,
    stale,
    highPrio,
    donePct: total ? Math.round((done / total) * 100) : 0,
  }
})

/** Statuskategorie-Verteilung (To Do / In Arbeit / Erledigt) für Donut. */
const statusCategoryChart = computed(() => {
  const k = dashboardKpis.value
  const total = k.total || 1
  return [
    { label: 'To Do', value: k.todo, color: '#94a3b8', pct: Math.round((k.todo / total) * 100) },
    { label: 'In Arbeit', value: k.inProgress, color: '#3b82f6', pct: Math.round((k.inProgress / total) * 100) },
    { label: 'Erledigt', value: k.done, color: '#10b981', pct: Math.round((k.done / total) * 100) },
  ]
})

/** SVG-Donut-Segmente (stroke-dasharray) aus der Statusverteilung. */
const statusDonutSegments = computed(() => {
  const circumference = 2 * Math.PI * 42 // r = 42
  let offset = 0
  return statusCategoryChart.value
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / (dashboardKpis.value.total || 1)) * circumference
      const seg = { color: s.color, dash: `${len} ${circumference - len}`, offset: -offset }
      offset += len
      return seg
    })
})

const priorityChart = computed(() => distribution(dashboardIssues.value, (i) => i.priority))
const issueTypeChart = computed(() => distribution(dashboardIssues.value, (i) => i.issueType))
const assigneeChart = computed(() => assigneeWorkload(dashboardIssues.value))

/** Älteste offene Tickets (Handlungsbedarf). */
const staleIssues = computed(() =>
  dashboardIssues.value
    .filter((i) => i.statusCategory !== 'done')
    .map((i) => ({ ...i, age: daysSince(i.updated) }))
    .sort((a, b) => b.age - a.age)
    .slice(0, 6),
)

/** KPIs des aktiven Sprints. */
const sprintKpis = computed(() => {
  const s = dashboardSprint.value
  if (!s) return null
  const total = s.issues.length
  const done = s.issues.filter((i) => i.statusCategory === 'done').length
  const inProgress = s.issues.filter((i) => i.statusCategory === 'indeterminate').length
  const todo = total - done - inProgress
  const daysLeft = s.sprint.endDate ? Math.max(0, -daysSince(s.sprint.endDate)) : null
  return {
    total,
    done,
    inProgress,
    todo,
    donePct: total ? Math.round((done / total) * 100) : 0,
    daysLeft,
  }
})

/** Sprint-Zeitraum formatiert. */
const sprintDateRange = computed(() => {
  const s = dashboardSprint.value?.sprint
  if (!s?.startDate || !s?.endDate) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  return `${fmt(s.startDate)} – ${fmt(s.endDate)}`
})

/** Verteilungen innerhalb des aktiven Sprints. */
const sprintPriorityChart = computed(() =>
  dashboardSprint.value ? distribution(dashboardSprint.value.issues, (i) => i.priority) : [],
)
const sprintTypeChart = computed(() =>
  dashboardSprint.value ? distribution(dashboardSprint.value.issues, (i) => i.issueType) : [],
)
const sprintAssigneeChart = computed(() =>
  dashboardSprint.value ? assigneeWorkload(dashboardSprint.value.issues, 6) : [],
)

/** Ampelfarbe für Statuskategorie-Badge. */
function categoryBadgeClass(cat: JiraProjectIssue['statusCategory']): string {
  switch (cat) {
    case 'done':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'indeterminate':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

// UC1: Jira-Handover (Anforderung → Ticket) state
interface HandoverDraft {
  summary: string
  description: string
  issueType: string
}
const handoverDrafts = ref<Record<string, HandoverDraft>>({})
const handoverExpanded = ref<Record<string, boolean>>({})
const handoverPrepBusyId = ref<string | null>(null)
const handoverBatch = ref<{ done: number; total: number } | null>(null)
const handoverSearch = ref('')
const handoverFilter = ref<'all' | 'open' | 'done'>('all')

// Jira Quality tool state
const jiraQualityIssues = ref<JiraProjectIssue[]>([])
const jiraQualityBusy = ref(false)
const jiraQualityCheckBusy = ref<string | null>(null)
const jiraQualityResults = ref<Record<string, string>>({})

// Ausbau: Ampel-Score, Aufklapp-Status, Filter/Suche/Sortierung, Batch-Fortschritt
type ReviewScore = 'gruen' | 'gelb' | 'rot'
const jiraQualityScores = ref<Record<string, ReviewScore>>({})
const jiraQualityExpanded = ref<Record<string, boolean>>({})
const jiraQualitySearch = ref('')
const jiraQualityStatusFilter = ref('all')
const jiraQualityScoreFilter = ref<'all' | 'unchecked' | ReviewScore>('all')
const jiraQualitySort = ref<'status' | 'score' | 'updated' | 'key'>('status')
const jiraQualityBatchProgress = ref<{ done: number; total: number } | null>(null)
const QUALITY_PAGE_SIZE = 25
const jiraQualityPage = ref(1)

/** Parst die von der KI vorangestellte Zeile `SCORE: rot|gelb|gruen`. */
function parseReviewScore(review: string): ReviewScore | null {
  const match = review.match(/SCORE:\s*(gruen|grün|gelb|rot)/i)
  if (!match) return null
  const raw = match[1].toLowerCase()
  if (raw === 'grün') return 'gruen'
  return raw as ReviewScore
}

/** Entfernt die SCORE-Steuerzeile aus dem angezeigten Review-Text. */
function stripScoreLine(review: string): string {
  return review.replace(/^\s*SCORE:\s*(gruen|grün|gelb|rot)\s*\n?/i, '').trim()
}

const jiraQualityStats = computed(() => {
  const total = jiraQualityIssues.value.length
  const checked = Object.keys(jiraQualityResults.value).length
  const critical = Object.values(jiraQualityScores.value).filter((s) => s === 'rot').length
  const warn = Object.values(jiraQualityScores.value).filter((s) => s === 'gelb').length
  const ok = Object.values(jiraQualityScores.value).filter((s) => s === 'gruen').length
  return { total, checked, critical, warn, ok, open: total - checked }
})

/** Verfügbare Status-Werte für das Filter-Dropdown. */
const jiraQualityStatuses = computed(() => {
  const set = new Set(jiraQualityIssues.value.map((i) => i.status))
  return Array.from(set).sort()
})

/** Gefilterte + sortierte Ticketliste. */
const jiraQualityFiltered = computed(() => {
  const search = jiraQualitySearch.value.trim().toLowerCase()
  const scoreRank: Record<string, number> = { rot: 0, gelb: 1, gruen: 2 }

  const list = jiraQualityIssues.value.filter((issue) => {
    if (jiraQualityStatusFilter.value !== 'all' && issue.status !== jiraQualityStatusFilter.value) {
      return false
    }
    if (jiraQualityScoreFilter.value === 'unchecked' && jiraQualityResults.value[issue.key]) {
      return false
    }
    if (
      jiraQualityScoreFilter.value !== 'all' &&
      jiraQualityScoreFilter.value !== 'unchecked' &&
      jiraQualityScores.value[issue.key] !== jiraQualityScoreFilter.value
    ) {
      return false
    }
    if (search) {
      const haystack = `${issue.key} ${issue.summary}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  return [...list].sort((a, b) => {
    switch (jiraQualitySort.value) {
      case 'key':
        return a.key.localeCompare(b.key, undefined, { numeric: true })
      case 'updated':
        return new Date(b.updated).getTime() - new Date(a.updated).getTime()
      case 'score': {
        const sa = jiraQualityScores.value[a.key]
        const sb = jiraQualityScores.value[b.key]
        const ra = sa ? scoreRank[sa] : 99
        const rb = sb ? scoreRank[sb] : 99
        return ra - rb
      }
      case 'status':
      default:
        return a.status.localeCompare(b.status) || a.key.localeCompare(b.key, undefined, { numeric: true })
    }
  })
})

/** Gesamtanzahl Seiten basierend auf gefilterter Liste. */
const jiraQualityTotalPages = computed(() =>
  Math.max(1, Math.ceil(jiraQualityFiltered.value.length / QUALITY_PAGE_SIZE)),
)

/** Tickets der aktuellen Seite. */
const jiraQualityVisible = computed(() => {
  const start = (jiraQualityPage.value - 1) * QUALITY_PAGE_SIZE
  return jiraQualityFiltered.value.slice(start, start + QUALITY_PAGE_SIZE)
})

/** Seitenummern-Liste für die Paginierungsleiste (max. 7 Buttons). */
const jiraQualityPageNumbers = computed(() => {
  const total = jiraQualityTotalPages.value
  const cur = jiraQualityPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (cur > 3) pages.push('…')
  for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p)
  if (cur < total - 2) pages.push('…')
  pages.push(total)
  return pages
})

/** Nach Status gruppierte Tickets der aktuellen Seite. */
const jiraQualityGrouped = computed(() => {
  const groups = new Map<string, JiraProjectIssue[]>()
  for (const issue of jiraQualityVisible.value) {
    const key = issue.status || 'Ohne Status'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(issue)
  }
  return Array.from(groups.entries()).map(([status, issues]) => ({ status, issues }))
})

// Filter-Änderungen → zurück auf Seite 1
watch([jiraQualitySearch, jiraQualityStatusFilter, jiraQualityScoreFilter, jiraQualitySort], () => {
  jiraQualityPage.value = 1
})

function toggleJiraReview(key: string) {
  jiraQualityExpanded.value = {
    ...jiraQualityExpanded.value,
    [key]: !jiraQualityExpanded.value[key],
  }
}

/** Badge-Klassen für die Ampel-Darstellung. */
function scoreBadgeClass(score?: ReviewScore): string {
  switch (score) {
    case 'rot':
      return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
    case 'gelb':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    case 'gruen':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    default:
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  }
}

function scoreLabel(score?: ReviewScore): string {
  switch (score) {
    case 'rot':
      return 'Kritisch'
    case 'gelb':
      return 'Mängel'
    case 'gruen':
      return 'OK'
    default:
      return 'Ungeprüft'
  }
}

function firstRequirementText(): string {
  return store.requirements[0]?.text ?? store.tempValReqText
}

function glossaryText(): string {
  if (store.glossary.length) {
    return store.glossary.map((entry) => `${entry.term}: ${entry.definition}`).join('\n')
  }
  return 'MHD\nMDE-Geraet\nWWS\nOut-of-Stock\nReduktionsregel'
}

function demoObservationText(): string {
  return 'Klaus haelt die MHD-Runde taeglich von 08:00-09:30 Uhr durch. Er traegt Ablaufdaten mit einem Kugelschreiber auf einem Zettel ein und tippt diese danach in eine private Excel-Datei auf seinem Firmenhandy. Out-of-Stock-Meldungen schickt er per WhatsApp an die Lager-Gruppe. Wenn der Handscanner haengt, markiert er Artikel mit einem Kugelschreiber direkt auf der Verpackung.'
}

function demoLegacyText(): string {
  return 'if (daysUntilExpiry <= 3) { discount = product.isPrivateLabel ? 30 : 20; } if (daysUntilExpiry <= 1) { discount = 50; } syncInventoryBatch("06:00"); deviceAssignment = employeeId + departmentId;'
}

function demoFeatureText(): string {
  return 'Automatische Anzeige kritischer MHD-Artikel direkt nach dem Scan inklusive Reduktionsregel und Out-of-Stock-Meldung.'
}

function demoWorkshopText(): string {
  return 'Ziel: Anforderungen fuer die Scanner-App gemeinsam ermitteln und priorisieren. Warenabschriften senken, OoS-Situationen reduzieren. Teilnehmer: Klaus (Marktmitarbeiter Frische), Sandra (Abteilungsleiterin Molkerei), Filialleitung, IT-Leitung, WWS-Dienstleister.'
}

function initialInputForVariant(): string {
  if (props.toolId === 'prep' && selectedVariant.value === 'simulation') {
    return result.value || store.tempTranscript
  }

  if (props.toolId === 'impact') {
    return 'Das WWS soll durch eine neue Cloud-Loesung (SaaS) ersetzt werden.'
  }

  return initialInput()
}

function buildVarMap(): Record<string, string> {
  const requirement = firstRequirementText()

  switch (props.toolId) {
    case 'prep':
      if (selectedVariant.value === 'simulation') {
        return {
          Kontext: store.tempVision,
          Persona: store.tempPersonaText,
          'Interview-Leitfaden': input.value,
        }
      }
      return {
        Kontext: store.tempVision || input.value,
        Persona: store.tempPersonaText || input.value,
      }
    case 'traceability':
      return {
        'JSON Array aller Anforderungen': JSON.stringify(store.requirements, null, 2),
      }
    case 'impact':
      return {
        'Anf. Text': requirement,
        Wunsch: input.value,
        'Ganzes Backlog': JSON.stringify(store.requirements, null, 2),
      }
    case 'translate':
    case 'poker':
    case 'backlog':
      return {
        Anforderung: requirement,
        'Gewählte Anforderung': requirement,
      }
    default:
      return {}
  }
}

function navigateToRecommendation(targetToolId: string, pillar: string) {
  store.setView(targetToolId, pillar)
}

/** Sinnvolle Vorbelegung der Eingabe je nach Werkzeug-Kontext. */
function initialInput(): string {
  switch (props.toolId) {
    case 'goals':
    case 'context':
    case 'stakeholder':
    case 'matrix':
      return store.tempVision
    case 'persona':
      return store.tempPersonaText
    case 'prep':
      return store.tempPersonaText || store.tempVision
    case 'questionnaire':
      return 'Scanner-App fuer MHD-Pruefung und Out-of-Stock-Meldung im Supermarkt'
    case 'apprenticing':
      return demoObservationText()
    case 'archaeology':
      return demoLegacyText()
    case 'scamper':
    case 'kano':
      return demoFeatureText()
    case 'workshop':
      return demoWorkshopText()
    case 'extract_req':
      return store.tempTranscript
    case 'formulate':
      return store.tempNote
    case 'glossary_extract':
      return store.tempNote || store.tempTranscript
    case 'glossary_manage':
      return glossaryText()
    case 'modeling':
      return store.tempVision || store.tempNote
    case 'backlog':
    case 'poker':
    case 'translate':
      return firstRequirementText()
    case 'traceability':
      return store.requirements.length ? JSON.stringify(store.requirements, null, 2) : firstRequirementText()
    case 'impact':
      return 'Das WWS soll durch eine neue Cloud-Loesung (SaaS) ersetzt werden.'
    case 'smells':
    case 'tests':
    case 'perspective':
    case 'conflict':
    case 'devil':
    case 'compliance':
    case 'dor':
    case 'bva':
    case 'nfr':
      return store.tempValReqText
    default:
      return ''
  }
}

function resetForTool() {
  if (isExportTool.value) {
    input.value = ''
    result.value = exportPreview.value
    selectedVariant.value = undefined
    return
  }

  if (isJiraDashboardTool.value) {
    input.value = ''
    result.value = ''
    selectedVariant.value = undefined
    dashboardIssues.value = []
    dashboardSprint.value = null
    dashboardLoaded.value = false
    dashboardUpdatedAt.value = ''
    return
  }

  if (isJiraHandoverTool.value) {
    input.value = ''
    result.value = ''
    selectedVariant.value = undefined
    handoverExpanded.value = {}
    handoverSearch.value = ''
    handoverFilter.value = 'all'
    return
  }

  if (isJiraQualityTool.value) {
    input.value = ''
    result.value = ''
    selectedVariant.value = undefined
    jiraQualityIssues.value = []
    jiraQualityResults.value = {}
    return
  }

  input.value = initialInputForVariant()
  result.value = ''
  selectedVariant.value = variantKeys.value[0]
}

watch(() => props.toolId, resetForTool, { immediate: true })

watch(selectedVariant, () => {
  input.value = initialInputForVariant()
})

async function run() {
  if (isExportTool.value) {
    result.value = exportPreview.value
    downloadProjectExport()
    show('re-context.md exportiert.', 'success')
    return
  }

  if (isJiraDashboardTool.value) {
    await refreshJiraDashboard()
    return
  }

  if (!input.value.trim()) {
    show('Bitte zuerst eine Eingabe machen.', 'error')
    return
  }
  loading.value = true
  result.value = ''
  try {
    if (isDemoMode.value) {
      result.value = getDemoResponse(props.toolId, input.value, selectedVariant.value)
      store.applyToolResult(props.toolId, input.value, result.value, selectedVariant.value)
      show('Demo-Antwort geladen.', 'success')
    } else {
      const { system, user } = getEffectivePrompts(
        props.toolId,
        input.value,
        buildVarMap(),
        selectedVariant.value,
      )
      result.value = await callAi(user, system)
      store.applyToolResult(props.toolId, input.value, result.value, selectedVariant.value)
    }
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Unerwarteter Fehler.'
    show(msg, 'error')
  } finally {
    loading.value = false
  }
}

const mermaidCode = computed(() =>
  result.value.replace(/```mermaid/g, '').replace(/```/g, '').trim(),
)

function copyResult() {
  navigator.clipboard.writeText(result.value)
  show('Ergebnis kopiert!', 'success')
}

function copyExport() {
  navigator.clipboard.writeText(exportPreview.value)
  show('Export-Markdown kopiert!', 'success')
}

function parseBacklogEstimate(text: string): { complexity: string; priority: string } {
  const normalized = text.replace(/\*\*/g, '').trim()
  const parts = normalized.split('|').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { complexity: parts[0], priority: parts[1] }
  }

  const tokens = normalized.split(/\s+/)
  if (tokens.length >= 2) {
    return { complexity: tokens[0], priority: tokens[1] }
  }

  return { complexity: normalized || 'Unklar', priority: 'Unklar' }
}

async function estimateRequirement(reqId: string, reqText: string) {
  backlogBusy.value = true
  backlogBusyId.value = reqId
  try {
    let aiResult = ''
    if (isDemoMode.value) {
      aiResult = getDemoResponse('backlog', reqText, selectedVariant.value)
    } else {
      const { system, user } = getEffectivePrompts(
        'backlog',
        reqText,
        {
          Anforderung: reqText,
          'Gewählte Anforderung': reqText,
        },
      )
      aiResult = await callAi(user, system)
    }

    const estimate = parseBacklogEstimate(aiResult)
    store.setRequirementEstimation(reqId, estimate.complexity, estimate.priority)
    show(`Schätzung gespeichert: ${estimate.complexity} | ${estimate.priority}`, 'success')
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Schätzung fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    backlogBusy.value = false
    backlogBusyId.value = null
  }
}

async function estimateAllRequirements() {
  if (!store.requirements.length) {
    show('Keine Anforderungen vorhanden.', 'error')
    return
  }

  for (const req of store.requirements) {
    await estimateRequirement(req.id, req.text)
  }
}

function buildAtlassianConfig() {
  return {
    domain: settings.atlassianDomain,
    email: settings.atlassianEmail,
    token: settings.atlassianToken,
    jiraProjectKey: settings.atlassianJiraProject,
    confluenceSpaceKey: settings.atlassianConfluenceSpace,
  }
}

// ---- UC1: Jira-Handover (Anforderung → Ticket) ----

function buildHandoverLabels(req: Requirement): string[] {
  const labels = req.type ? [`ireb-${req.type.toLowerCase().replace(/\s/g, '-')}`] : []
  if (req.complexity) labels.push(`complexity-${req.complexity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
  return labels
}

function defaultHandoverDraft(req: Requirement): HandoverDraft {
  const firstLine = req.text.split('\n')[0].trim()
  return {
    summary: `[${req.id}] ${firstLine.slice(0, 110)}`,
    description: req.text,
    issueType: mapTypeToIssueType(req.type),
  }
}

/** Stellt sicher, dass für die Anforderung ein bearbeitbarer Entwurf existiert. */
function ensureHandoverDraft(req: Requirement): HandoverDraft {
  if (!handoverDrafts.value[req.id]) {
    const hasStored = req.jiraSummary || req.jiraDescription || req.jiraIssueType
    const draft: HandoverDraft = hasStored
      ? {
          summary: req.jiraSummary ?? defaultHandoverDraft(req).summary,
          description: req.jiraDescription ?? req.text,
          issueType: req.jiraIssueType ?? mapTypeToIssueType(req.type),
        }
      : defaultHandoverDraft(req)
    handoverDrafts.value = { ...handoverDrafts.value, [req.id]: draft }
  }
  return handoverDrafts.value[req.id]
}

function toggleHandover(req: Requirement) {
  ensureHandoverDraft(req)
  handoverExpanded.value = { ...handoverExpanded.value, [req.id]: !handoverExpanded.value[req.id] }
}

function parseHandoverDraft(aiResult: string, req: Requirement): HandoverDraft {
  const match = aiResult.match(/^\s*SUMMARY:\s*(.+)$/im)
  const summary = match ? match[1].trim().slice(0, 120) : defaultHandoverDraft(req).summary
  const description = aiResult.replace(/^\s*SUMMARY:\s*.+$/im, '').trim()
  return {
    summary,
    description: description || req.text,
    issueType: handoverDrafts.value[req.id]?.issueType ?? mapTypeToIssueType(req.type),
  }
}

/** KI bereitet aus der Anforderung einen umsetzungsreifen Ticket-Entwurf auf. */
async function prepareHandoverDraft(req: Requirement) {
  handoverPrepBusyId.value = req.id
  try {
    const systemPrompt =
      'Du bist ein IREB-zertifizierter Requirements Engineer und bereitest eine Anforderung als umsetzungsreifes Jira-Ticket auf. ' +
      'Beginne deine Antwort ZWINGEND mit einer eigenen ersten Zeile im Format "SUMMARY: <prägnanter Ticket-Titel, max 120 Zeichen>". ' +
      'Gib danach eine Markdown-Beschreibung aus mit den Abschnitten: ' +
      '**User Story** (Format: "Als <Rolle> möchte ich <Ziel>, damit <Nutzen>"), ' +
      '**Akzeptanzkriterien** (als Liste im Given-When-Then-Format) ' +
      'und **Hinweise zur Umsetzung** (kurze Stichpunkte). ' +
      'Formuliere klar, testbar und ohne Weichmacher.'
    const userPrompt = [
      `Anforderung: ${req.text}`,
      req.type ? `Typ: ${req.type}` : '',
      req.complexity ? `Komplexität: ${req.complexity}` : '',
      req.priority ? `Priorität (MoSCoW): ${req.priority}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    let aiResult: string
    if (isDemoMode.value) {
      aiResult =
        `SUMMARY: [${req.id}] ${req.text.split('\n')[0].slice(0, 100)}\n\n` +
        `**User Story**\nAls Nutzer möchte ich die beschriebene Funktion, damit mein Arbeitsablauf effizienter wird.\n\n` +
        `**Akzeptanzkriterien**\n- Given ein gültiger Zustand, When die Aktion ausgeführt wird, Then erfolgt das erwartete Ergebnis.\n\n` +
        `**Hinweise zur Umsetzung**\n- Demo-Modus: beispielhafte Aufbereitung.`
    } else {
      aiResult = await callAi(userPrompt, systemPrompt)
    }

    const draft = parseHandoverDraft(aiResult, req)
    handoverDrafts.value = { ...handoverDrafts.value, [req.id]: draft }
    handoverExpanded.value = { ...handoverExpanded.value, [req.id]: true }
    store.setRequirementJiraDraft(req.id, draft)
    show(`Ticket-Entwurf für ${req.id} vorbereitet.`, 'success')
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Aufbereitung fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    handoverPrepBusyId.value = null
  }
}

/** Legt das Ticket in Jira an (nutzt den aktuellen, ggf. editierten Entwurf). */
async function createHandoverTicket(req: Requirement) {
  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen (Schlüssel-Symbol) konfigurieren.', 'error')
    return
  }
  const draft = ensureHandoverDraft(req)
  jiraBusy.value = true
  jiraBusyId.value = req.id
  try {
    const priority = mapMoscowToPriority(req.priority)
    const issue = await createIssueFromRequirementAdapter(
      draft.summary,
      draft.description,
      buildHandoverLabels(req),
      priority,
      draft.issueType,
    )
    store.setRequirementJiraDraft(req.id, draft)
    store.setRequirementJiraKey(req.id, issue.key)
    show(`Jira-Ticket erstellt: ${issue.key}`, 'success')
  } catch (error) {
    const msg = error instanceof JiraError ? error.message : (error instanceof AtlassianError ? error.message : 'Jira-Erstellung fehlgeschlagen.')
    show(msg, 'error')
  } finally {
    jiraBusy.value = false
    jiraBusyId.value = null
  }
}

/** Batch: alle noch nicht übergebenen (gefilterten) Anforderungen aufbereiten + anlegen. */
async function handoverAll() {
  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen konfigurieren.', 'error')
    return
  }
  const pending = handoverFiltered.value.filter((r) => !r.jiraKey)
  if (!pending.length) {
    show('Alle sichtbaren Anforderungen sind bereits übergeben.', 'error')
    return
  }
  handoverBatch.value = { done: 0, total: pending.length }
  try {
    for (const req of pending) {
      if (!handoverDrafts.value[req.id] && !req.jiraSummary) {
        await prepareHandoverDraft(req)
      }
      await createHandoverTicket(req)
      if (handoverBatch.value) {
        handoverBatch.value = { done: handoverBatch.value.done + 1, total: pending.length }
      }
    }
    show(`${pending.length} Anforderung${pending.length !== 1 ? 'en' : ''} nach Jira übergeben.`, 'success')
  } finally {
    handoverBatch.value = null
  }
}

const handoverStats = computed(() => {
  const total = store.requirements.length
  const pushed = store.requirements.filter((r) => r.jiraKey).length
  const prepared = store.requirements.filter(
    (r) => !r.jiraKey && (handoverDrafts.value[r.id] || r.jiraSummary),
  ).length
  return { total, pushed, prepared, open: total - pushed }
})

const handoverFiltered = computed(() => {
  const search = handoverSearch.value.trim().toLowerCase()
  return store.requirements.filter((req) => {
    if (handoverFilter.value === 'open' && req.jiraKey) return false
    if (handoverFilter.value === 'done' && !req.jiraKey) return false
    if (search) {
      const haystack = `${req.id} ${req.text}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
})

async function syncToConfluence() {
  if (!settings.atlassianConfluenceSpace) {
    show('Bitte zuerst einen Confluence-Space-Schlüssel in den Einstellungen eintragen.', 'error')
    return
  }

  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen konfigurieren.', 'error')
    return
  }

  confluenceBusy.value = true
  try {
    const result = await syncProjectToConfluence(buildAtlassianConfig(), {
      vision: store.globalContext.vision || store.tempVision,
      stakeholders: store.globalContext.stakeholders,
      personas: store.globalContext.personas,
      requirements: store.requirements,
      glossary: store.glossary,
      existingPageId: store.confluencePageId || undefined,
    })
    store.setConfluencePageId(result.id)
    show(`Confluence-Seite aktualisiert. ID: ${result.id}`, 'success')
  } catch (error) {
    const msg = error instanceof AtlassianError ? error.message : 'Confluence-Sync fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    confluenceBusy.value = false
  }
}

async function refreshJiraDashboard() {
  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen konfigurieren.', 'error')
    return
  }

  jiraDashboardBusy.value = true
  try {
    // Alle Projekt-Issues (paginiert) + aktiven Sprint parallel laden
    const [issues, sprint] = await Promise.all([
      getJiraProjectIssues(buildAtlassianConfig()),
      getActiveSprintWithIssues(buildAtlassianConfig()).catch(() => null),
    ])

    dashboardIssues.value = issues
    dashboardSprint.value = sprint
    dashboardLoaded.value = true
    dashboardUpdatedAt.value = new Date().toLocaleString('de-DE')

    if (!issues.length) {
      show('Dashboard aktualisiert (0 Tickets).', 'success')
    } else {
      show(`Dashboard aktualisiert (${issues.length} Tickets${sprint ? `, Sprint „${sprint.sprint.name}"` : ''}).`, 'success')
    }
  } catch (error) {
    const msg = error instanceof JiraError ? error.message : (error instanceof AtlassianError ? error.message : 'Dashboard konnte nicht geladen werden.')
    show(msg, 'error')
  } finally {
    jiraDashboardBusy.value = false
  }
}

async function loadJiraQualityIssues() {
  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen konfigurieren.', 'error')
    return
  }
  jiraQualityBusy.value = true
  try {
    jiraQualityIssues.value = await getJiraProjectIssues(buildAtlassianConfig())
    jiraQualityResults.value = {}
    jiraQualityScores.value = {}
    jiraQualityExpanded.value = {}
    jiraQualityBatchProgress.value = null
    jiraQualityPage.value = 1
    if (!jiraQualityIssues.value.length) {
      show('Keine Tickets im Projekt gefunden.', 'error')
    } else {
      show(`${jiraQualityIssues.value.length} Tickets geladen.`, 'success')
    }
  } catch (error) {
    const msg = error instanceof AtlassianError ? error.message : 'Tickets konnten nicht geladen werden.'
    show(msg, 'error')
  } finally {
    jiraQualityBusy.value = false
  }
}

async function checkJiraTicketQuality(issue: JiraProjectIssue) {
  jiraQualityCheckBusy.value = issue.key
  try {
    let ticketText = `Titel: ${issue.summary}`
    try {
      const detail = await getJiraIssueDetail(buildAtlassianConfig(), issue.key)
      if (detail.description) {
        ticketText = `Titel: ${detail.summary}\n\nBeschreibung:\n${detail.description}`
      }
    } catch {
      // Fallback auf Summary
    }

    const systemPrompt =
      'Du bist ein IREB-zertifizierter Requirements Engineer. Prüfe das folgende Jira-Ticket auf Anforderungsqualität. ' +
      'Beginne deine Antwort ZWINGEND mit einer eigenen ersten Zeile im Format "SCORE: rot|gelb|gruen" (genau eines auswählen): ' +
      'gruen = Anforderung erfüllt die Qualitätskriterien weitgehend, gelb = erkennbare Mängel/Verbesserungsbedarf, rot = kritische Mängel (unklar, untestbar oder unvollständig). ' +
      'Bewerte danach: 1. Klarheit und Eindeutigkeit (Smells, Weichmacher, Passiv-Konstruktionen), 2. Vollständigkeit (fehlende Bedingungen, Akteure, Prozessworte), 3. Testbarkeit (sind Abnahmekriterien ableitbar?), 4. IREB-Qualitätskriterien: Adäquat, Notwendig, Eindeutig, Vollständig, Prüfbar. Erstelle eine Checkliste mit ✅/❌ und konkreten Verbesserungsvorschlägen. Format: Markdown.'
    const userPrompt = `Jira-Ticket:\n${ticketText}`

    let aiResult: string
    if (isDemoMode.value) {
      aiResult = getDemoResponse('smells', ticketText, undefined)
    } else {
      aiResult = await callAi(userPrompt, systemPrompt)
    }

    jiraQualityResults.value = { ...jiraQualityResults.value, [issue.key]: aiResult }
    const score = parseReviewScore(aiResult)
    if (score) {
      jiraQualityScores.value = { ...jiraQualityScores.value, [issue.key]: score }
    }
    show(`Qualitätsprüfung für ${issue.key} abgeschlossen.`, 'success')
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Qualitätsprüfung fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    jiraQualityCheckBusy.value = null
  }
}

/** Prüft alle aktuell gefilterten, noch ungeprüften Tickets nacheinander mit Fortschritt. */
async function checkAllJiraTickets() {
  const pending = jiraQualityFiltered.value.filter((issue) => !jiraQualityResults.value[issue.key])
  if (!pending.length) {
    show('Alle sichtbaren Tickets sind bereits geprüft.', 'success')
    return
  }
  jiraQualityBatchProgress.value = { done: 0, total: pending.length }
  try {
    for (const issue of pending) {
      await checkJiraTicketQuality(issue)
      if (jiraQualityBatchProgress.value) {
        jiraQualityBatchProgress.value = {
          done: jiraQualityBatchProgress.value.done + 1,
          total: pending.length,
        }
      }
    }
    show(`${pending.length} Tickets geprüft.`, 'success')
  } finally {
    jiraQualityBatchProgress.value = null
  }
}
</script>

<template>
  <div v-if="tool" class="mx-auto max-w-3xl">
    <!-- Kopf -->
    <div class="mb-6 flex items-start gap-4">
      <div class="rounded-2xl bg-brand-soft p-3 text-brand dark:text-brand-strong">
        <AppIcon :name="tool.icon" :size="26" />
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-extrabold text-slate-800 dark:text-slate-100 sm:text-2xl">
            {{ tool.label }}
          </h2>
          <button
            class="rounded-lg p-1.5 transition-colors"
            :class="isFavorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'"
            :aria-label="isFavorite ? 'Favorit entfernen' : 'Als Favorit'"
            @click="store.toggleFavorite(toolId)"
          >
            <AppIcon name="star" :size="18" />
          </button>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ tool.desc }}</p>
      </div>
    </div>

    <!-- Warum-Box -->
    <div
      class="mb-6 rounded-2xl border border-brand bg-brand-soft p-4 text-sm text-slate-600 dark:text-slate-300"
    >
      <div class="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand dark:text-brand-strong">
        <AppIcon name="lightbulb" :size="14" /> Warum nach IREB?
      </div>
      {{ tool.why }}
    </div>

    <div class="glass-panel rounded-2xl border p-5 sm:p-7">
      <p class="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
        {{ tool.instruction }}
      </p>

      <!-- Varianten (z. B. UML-Typ, DoR-Schema) -->
      <div v-if="variantKeys.length" class="mb-4">
        <label class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Variante
        </label>
        <select
          v-model="selectedVariant"
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
        >
          <option v-for="k in variantKeys" :key="k" :value="k">{{ k }}</option>
        </select>
      </div>

      <template v-if="isExportTool">
        <p class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          Dieser Export bündelt Vision, Systemkontext, Stakeholder, Personas, Glossar, Anforderungen und einen maschinenlesbaren JSON-Snapshot in einer Datei für Claude Code oder ähnliche KI-Werkzeuge.
        </p>

        <div class="mb-4 flex flex-wrap gap-3">
          <button
            class="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700"
            @click="run"
          >
            <AppIcon name="download" :size="18" />
            Markdown exportieren
          </button>

          <button
            class="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            @click="copyExport"
          >
            <AppIcon name="copy" :size="18" />
            Markdown kopieren
          </button>

          <button
            class="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
            :disabled="confluenceBusy"
            :title="settings.atlassianConfluenceSpace ? 'Projektdokumentation nach Confluence synchronisieren' : 'Confluence-Space-Schlüssel in Atlassian-Einstellungen hinterlegen'"
            @click="syncToConfluence"
          >
            <AppIcon :name="confluenceBusy ? 'loader-circle' : 'cloud-upload'" :size="18" :class="{ 'animate-spin': confluenceBusy }" />
            {{ store.confluencePageId ? 'Confluence aktualisieren' : 'Nach Confluence' }}
          </button>
        </div>
      </template>

      <template v-else-if="isJiraDashboardTool">
        <p class="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
          Liest alle Jira-Tickets des Projekts ein und erzeugt ein RE-Health-Dashboard mit KPIs,
          Status-/Prioritäts-/Typ-Verteilung, Verteilung nach Bearbeiter, Handlungsbedarf (veraltete Tickets)
          und – falls vorhanden – dem aktuell laufenden Sprint.
        </p>

        <button
          class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
          :disabled="jiraDashboardBusy"
          @click="refreshJiraDashboard"
        >
          <AppIcon :name="jiraDashboardBusy ? 'loader-circle' : 'refresh-cw'" :size="18" :class="{ 'animate-spin': jiraDashboardBusy }" />
          {{ jiraDashboardBusy ? 'Dashboard wird geladen …' : dashboardLoaded ? 'Dashboard aktualisieren' : 'RE-Health laden' }}
        </button>

        <p v-if="dashboardLoaded && !dashboardIssues.length" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          Keine Tickets im Projekt <strong>{{ settings.atlassianJiraProject }}</strong> gefunden.
        </p>

        <div v-if="dashboardLoaded && dashboardIssues.length" class="space-y-6">
          <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span>Projekt <strong class="text-slate-500 dark:text-slate-400">{{ settings.atlassianJiraProject }}</strong></span>
            <span>Stand: {{ dashboardUpdatedAt }}</span>
          </div>

          <!-- KPI-Karten -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><AppIcon name="layers" :size="13" /> Gesamt</div>
              <div class="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{{ dashboardKpis.total }}</div>
            </div>
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-500"><AppIcon name="circle-check-big" :size="13" /> Erledigt</div>
              <div class="mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{{ dashboardKpis.donePct }}<span class="text-sm">%</span></div>
              <div class="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">{{ dashboardKpis.done }} von {{ dashboardKpis.total }}</div>
            </div>
            <div class="rounded-xl border border-blue-200 bg-blue-50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-500"><AppIcon name="clock" :size="13" /> In Arbeit</div>
              <div class="mt-1 text-2xl font-extrabold text-blue-700 dark:text-blue-300">{{ dashboardKpis.inProgress }}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><AppIcon name="list-todo" :size="13" /> To Do</div>
              <div class="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{{ dashboardKpis.todo }}</div>
            </div>
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500"><AppIcon name="alarm-clock" :size="13" /> Veraltet</div>
              <div class="mt-1 text-2xl font-extrabold text-amber-700 dark:text-amber-300">{{ dashboardKpis.stale }}</div>
              <div class="text-[11px] text-amber-600/70 dark:text-amber-400/70">&gt; {{ STALE_DAYS }} Tage inaktiv</div>
            </div>
            <div class="rounded-xl border border-red-200 bg-red-50 p-3.5 dark:border-red-900/40 dark:bg-red-950/20">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-500"><AppIcon name="flame" :size="13" /> Hohe Prio</div>
              <div class="mt-1 text-2xl font-extrabold text-red-700 dark:text-red-300">{{ dashboardKpis.highPrio }}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><AppIcon name="user-round-x" :size="13" /> Ohne Zuw.</div>
              <div class="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{{ dashboardKpis.unassigned }}</div>
            </div>
          </div>

          <!-- Status-Donut + Legende -->
          <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
            <h4 class="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Statusverteilung</h4>
            <div class="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
              <div class="relative h-36 w-36 shrink-0">
                <svg viewBox="0 0 100 100" class="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" class="text-slate-100 dark:text-slate-800" stroke-width="14" />
                  <circle
                    v-for="(seg, idx) in statusDonutSegments"
                    :key="idx"
                    cx="50" cy="50" r="42" fill="none"
                    :stroke="seg.color"
                    stroke-width="14"
                    :stroke-dasharray="seg.dash"
                    :stroke-dashoffset="seg.offset"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{{ dashboardKpis.donePct }}%</span>
                  <span class="text-[10px] uppercase tracking-wider text-slate-400">erledigt</span>
                </div>
              </div>
              <div class="flex-1 space-y-2 self-stretch">
                <div v-for="s in statusCategoryChart" :key="s.label" class="flex items-center gap-3">
                  <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: s.color }" />
                  <span class="w-20 shrink-0 text-xs text-slate-600 dark:text-slate-300">{{ s.label }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div class="h-full rounded-full" :style="{ width: `${s.pct}%`, backgroundColor: s.color }" />
                  </div>
                  <span class="w-14 shrink-0 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{{ s.value }} · {{ s.pct }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Balkendiagramme: Priorität / Typ -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
              <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Nach Priorität</h4>
              <div class="space-y-2">
                <div v-for="b in priorityChart" :key="b.label" class="flex items-center gap-2">
                  <span class="w-20 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" :title="b.label">{{ b.label }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div class="h-full rounded-full bg-red-400" :style="{ width: `${b.pct}%` }" />
                  </div>
                  <span class="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{{ b.value }}</span>
                </div>
              </div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
              <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Nach Typ</h4>
              <div class="space-y-2">
                <div v-for="b in issueTypeChart" :key="b.label" class="flex items-center gap-2">
                  <span class="w-20 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" :title="b.label">{{ b.label }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div class="h-full rounded-full bg-brand" :style="{ width: `${b.pct}%` }" />
                  </div>
                  <span class="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{{ b.value }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Verteilung nach Bearbeiter -->
          <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
            <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Auslastung nach Bearbeiter</h4>
            <div class="space-y-2">
              <div v-for="b in assigneeChart" :key="b.label" class="flex items-center gap-2">
                <span class="w-32 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" :title="b.label">{{ b.label }}</span>
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div class="h-full rounded-full bg-indigo-400" :style="{ width: `${b.pct}%` }" />
                </div>
                <span class="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{{ b.value }}</span>
                <span class="w-14 shrink-0 text-right text-[11px] font-medium text-indigo-500 dark:text-indigo-400">{{ b.points }} SP</span>
              </div>
            </div>
          </div>

          <!-- Handlungsbedarf: veraltete Tickets -->
          <div v-if="staleIssues.length" class="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/10">
            <h4 class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <AppIcon name="alarm-clock" :size="14" /> Handlungsbedarf – älteste offene Tickets
            </h4>
            <div class="space-y-1.5">
              <a
                v-for="i in staleIssues"
                :key="i.key"
                :href="i.url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 transition-colors hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
              >
                <span class="shrink-0 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{{ i.key }}</span>
                <span class="flex-1 truncate text-xs text-slate-700 dark:text-slate-200">{{ i.summary }}</span>
                <span class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium" :class="categoryBadgeClass(i.statusCategory)">{{ i.status }}</span>
                <span class="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400">{{ i.age }} T</span>
              </a>
            </div>
          </div>

          <!-- Aktueller Sprint -->
          <div v-if="dashboardSprint && sprintKpis" class="rounded-2xl border border-brand bg-brand-soft p-5 dark:border-brand-strong/40">
            <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand dark:text-brand-strong">
                  <AppIcon name="target" :size="14" /> Aktueller Sprint · {{ dashboardSprint.boardName }}
                </div>
                <h4 class="mt-1 text-base font-extrabold text-slate-800 dark:text-slate-100">{{ dashboardSprint.sprint.name }}</h4>
                <p v-if="dashboardSprint.sprint.goal" class="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">„{{ dashboardSprint.sprint.goal }}"</p>
              </div>
              <div class="text-right text-xs text-slate-500 dark:text-slate-400">
                <div v-if="sprintDateRange" class="flex items-center justify-end gap-1"><AppIcon name="calendar" :size="12" /> {{ sprintDateRange }}</div>
                <div v-if="sprintKpis.daysLeft !== null" class="mt-0.5 font-semibold text-brand dark:text-brand-strong">
                  {{ sprintKpis.daysLeft === 0 ? 'Endet heute' : `noch ${sprintKpis.daysLeft} Tage` }}
                </div>
              </div>
            </div>

            <!-- Sprint-Fortschritt -->
            <div class="mb-3">
              <div class="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Fortschritt</span>
                <span class="font-semibold">{{ sprintKpis.done }} / {{ sprintKpis.total }} erledigt ({{ sprintKpis.donePct }}%)</span>
              </div>
              <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div class="h-full bg-emerald-500" :style="{ width: `${(sprintKpis.done / Math.max(sprintKpis.total, 1)) * 100}%` }" />
                <div class="h-full bg-blue-500" :style="{ width: `${(sprintKpis.inProgress / Math.max(sprintKpis.total, 1)) * 100}%` }" />
              </div>
              <div class="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-500" /> {{ sprintKpis.done }} erledigt</span>
                <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-blue-500" /> {{ sprintKpis.inProgress }} in Arbeit</span>
                <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-400" /> {{ sprintKpis.todo }} offen</span>
              </div>
            </div>

            <!-- Sprint-Verteilungen: Priorität / Typ -->
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div class="rounded-xl border border-white/60 bg-white/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <h5 class="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Nach Priorität</h5>
                <div class="space-y-2">
                  <div v-for="b in sprintPriorityChart" :key="b.label" class="flex items-center gap-2">
                    <span class="w-20 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" :title="b.label">{{ b.label }}</span>
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div class="h-full rounded-full bg-red-400" :style="{ width: `${b.pct}%` }" />
                    </div>
                    <span class="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{{ b.value }}</span>
                  </div>
                </div>
              </div>
              <div class="rounded-xl border border-white/60 bg-white/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <h5 class="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Nach Typ</h5>
                <div class="space-y-2">
                  <div v-for="b in sprintTypeChart" :key="b.label" class="flex items-center gap-2">
                    <span class="w-20 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" :title="b.label">{{ b.label }}</span>
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div class="h-full rounded-full bg-brand" :style="{ width: `${b.pct}%` }" />
                    </div>
                    <span class="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{{ b.value }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sprint-Auslastung nach Bearbeiter -->
            <div class="mt-4 rounded-xl border border-white/60 bg-white/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
              <h5 class="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Auslastung nach Bearbeiter</h5>
              <div class="space-y-2">
                <div v-for="b in sprintAssigneeChart" :key="b.label" class="flex items-center gap-2">
                  <span class="w-32 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" :title="b.label">{{ b.label }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div class="h-full rounded-full bg-indigo-400" :style="{ width: `${b.pct}%` }" />
                  </div>
                  <span class="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{{ b.value }}</span>
                  <span class="w-14 shrink-0 text-right text-[11px] font-medium text-indigo-500 dark:text-indigo-400">{{ b.points }} SP</span>
                </div>
              </div>
            </div>

            <!-- Sprint-Tickets -->
            <div class="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              <a
                v-for="i in dashboardSprint.issues"
                :key="i.key"
                :href="i.url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 transition-colors hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
              >
                <span class="shrink-0 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{{ i.key }}</span>
                <span class="flex-1 truncate text-xs text-slate-700 dark:text-slate-200">{{ i.summary }}</span>
                <span class="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{{ i.assignee }}</span>
                <span class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium" :class="categoryBadgeClass(i.statusCategory)">{{ i.status }}</span>
              </a>
            </div>
          </div>

          <div v-else class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            Kein aktiver Sprint gefunden (Kanban-Board oder kein laufender Sprint).
          </div>
        </div>
      </template>

      <template v-else-if="isJiraQualityTool">
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Laden Sie Jira-Tickets aus Ihrem Projekt und lassen Sie die KI jeden Ticket-Text gegen IREB-Qualitätskriterien prüfen. Die Ampel zeigt das Ergebnis: ⚪ ungeprüft · 🟢 OK · 🟡 Mängel · 🔴 kritisch.
        </p>

        <button
          class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-3.5 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          :disabled="jiraQualityBusy"
          @click="loadJiraQualityIssues"
        >
          <AppIcon :name="jiraQualityBusy ? 'loader-circle' : 'download'" :size="18" :class="{ 'animate-spin': jiraQualityBusy }" />
          {{ jiraQualityBusy ? 'Tickets werden geladen …' : 'Jira-Tickets laden' }}
        </button>

        <div v-if="jiraQualityIssues.length" class="space-y-4">
          <!-- A) Kennzahlen-Kopf -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <AppIcon name="layers" :size="13" /> {{ jiraQualityStats.total }} geladen
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <AppIcon name="search-check" :size="13" /> {{ jiraQualityStats.checked }} geprüft
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              🟢 {{ jiraQualityStats.ok }} OK
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              🟡 {{ jiraQualityStats.warn }} Mängel
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              🔴 {{ jiraQualityStats.critical }} kritisch
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              ⚪ {{ jiraQualityStats.open }} offen
            </span>
          </div>

          <!-- D) Filter-/Such-/Sortierleiste -->
          <div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div class="relative min-w-[180px] flex-1">
              <AppIcon name="search" :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="jiraQualitySearch"
                type="text"
                placeholder="Suche nach Key oder Titel …"
                class="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <select
              v-model="jiraQualityStatusFilter"
              class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Alle Status</option>
              <option v-for="s in jiraQualityStatuses" :key="s" :value="s">{{ s }}</option>
            </select>
            <select
              v-model="jiraQualityScoreFilter"
              class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Alle Bewertungen</option>
              <option value="unchecked">Nur ungeprüft</option>
              <option value="rot">Nur kritisch</option>
              <option value="gelb">Nur Mängel</option>
              <option value="gruen">Nur OK</option>
            </select>
            <select
              v-model="jiraQualitySort"
              class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="status">Sortierung: Status</option>
              <option value="score">Sortierung: Bewertung</option>
              <option value="updated">Sortierung: Aktualisiert</option>
              <option value="key">Sortierung: Key</option>
            </select>
          </div>

          <!-- E) Batch-Prüfen mit Fortschritt -->
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <button
              class="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/50 dark:bg-slate-900/60 dark:text-amber-300"
              :disabled="jiraQualityBatchProgress !== null || jiraQualityCheckBusy !== null"
              @click="checkAllJiraTickets"
            >
              <AppIcon :name="jiraQualityBatchProgress ? 'loader-circle' : 'sparkles'" :size="14" :class="{ 'animate-spin': jiraQualityBatchProgress }" />
              {{ jiraQualityBatchProgress ? `Prüfe … ${jiraQualityBatchProgress.done} / ${jiraQualityBatchProgress.total}` : 'Alle sichtbaren prüfen' }}
            </button>
            <div v-if="jiraQualityBatchProgress" class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/40">
              <div
                class="h-full rounded-full bg-amber-500 transition-all"
                :style="{ width: `${Math.round((jiraQualityBatchProgress.done / Math.max(jiraQualityBatchProgress.total, 1)) * 100)}%` }"
              />
            </div>
          </div>

          <!-- B/C) Gruppierung nach Status, kompakte Zeilen, einklappbares Review -->
          <div v-for="group in jiraQualityGrouped" :key="group.status" class="space-y-2">
            <h4 class="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {{ group.status }}
              <span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ group.issues.length }}</span>
            </h4>

            <div
              v-for="issue in group.issues"
              :key="issue.key"
              class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div class="flex items-center gap-3 px-3 py-2.5">
                <span
                  class="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  :class="scoreBadgeClass(jiraQualityScores[issue.key])"
                  :title="scoreLabel(jiraQualityScores[issue.key])"
                >
                  {{ jiraQualityScores[issue.key] === 'rot' ? '🔴' : jiraQualityScores[issue.key] === 'gelb' ? '🟡' : jiraQualityScores[issue.key] === 'gruen' ? '🟢' : '⚪' }}
                </span>
                <a
                  :href="issue.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="shrink-0 text-xs font-bold uppercase tracking-wider text-blue-600 hover:underline dark:text-blue-400"
                >
                  {{ issue.key }}
                </a>
                <span class="hidden shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline dark:bg-slate-800 dark:text-slate-400">{{ issue.issueType }}</span>
                <span class="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{{ issue.summary }}</span>

                <button
                  v-if="jiraQualityResults[issue.key]"
                  class="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  :title="jiraQualityExpanded[issue.key] ? 'Review einklappen' : 'Review anzeigen'"
                  @click="toggleJiraReview(issue.key)"
                >
                  <AppIcon :name="jiraQualityExpanded[issue.key] ? 'chevron-up' : 'chevron-down'" :size="16" />
                </button>
                <button
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                  :disabled="jiraQualityCheckBusy === issue.key"
                  @click="checkJiraTicketQuality(issue)"
                >
                  <AppIcon :name="jiraQualityCheckBusy === issue.key ? 'loader-circle' : 'search-check'" :size="12" :class="{ 'animate-spin': jiraQualityCheckBusy === issue.key }" />
                  {{ jiraQualityCheckBusy === issue.key ? 'Prüfung …' : jiraQualityResults[issue.key] ? 'Erneut' : 'Prüfen' }}
                </button>
              </div>

              <div
                v-if="jiraQualityResults[issue.key] && jiraQualityExpanded[issue.key]"
                class="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div class="markdown-body text-sm text-slate-700 dark:text-slate-200" v-html="renderMarkdown(stripScoreLine(jiraQualityResults[issue.key]))" />
              </div>
            </div>
          </div>

          <p v-if="!jiraQualityFiltered.length" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            Keine Tickets entsprechen den aktuellen Filtern.
          </p>

          <!-- Mehr anzeigen -->
          <!-- Paginierung -->
          <div v-if="jiraQualityTotalPages > 1" class="flex flex-col items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p class="text-xs text-slate-400 dark:text-slate-500">
              Seite {{ jiraQualityPage }} von {{ jiraQualityTotalPages }}
              &middot; {{ jiraQualityFiltered.length }} Tickets insgesamt
            </p>
            <div class="flex items-center gap-1">
              <!-- Zurück -->
              <button
                class="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800"
                :disabled="jiraQualityPage === 1"
                aria-label="Vorherige Seite"
                @click="jiraQualityPage--"
              >
                <AppIcon name="chevron-left" :size="15" />
              </button>

              <!-- Seitenzahlen -->
              <template v-for="p in jiraQualityPageNumbers" :key="String(p)">
                <span
                  v-if="p === '…'"
                  class="px-1 text-xs text-slate-400 dark:text-slate-500"
                >…</span>
                <button
                  v-else
                  class="min-w-[2rem] rounded-lg border px-2 py-1 text-xs font-semibold transition-colors"
                  :class="p === jiraQualityPage
                    ? 'border-brand bg-brand text-white dark:border-brand-strong dark:bg-brand-strong'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'"
                  @click="jiraQualityPage = (p as number)"
                >
                  {{ p }}
                </button>
              </template>

              <!-- Weiter -->
              <button
                class="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800"
                :disabled="jiraQualityPage === jiraQualityTotalPages"
                aria-label="Nächste Seite"
                @click="jiraQualityPage++"
              >
                <AppIcon name="chevron-right" :size="15" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="isJiraHandoverTool">
        <p class="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
          Der Abschluss des roten IREB-Pfads: Bereiten Sie validierte Anforderungen KI-gestützt zu umsetzungsreifen Jira-Tickets auf (Titel, User Story, Akzeptanzkriterien), prüfen Sie die Vorschau und legen Sie sie in Jira an.
        </p>

        <div v-if="store.requirements.length" class="space-y-4">
          <!-- Kennzahlen-Kopf -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <AppIcon name="layers" :size="13" /> {{ handoverStats.total }} Anforderungen
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              ✍️ {{ handoverStats.prepared }} vorbereitet
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ✅ {{ handoverStats.pushed }} übergeben
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              ⚪ {{ handoverStats.open }} offen
            </span>
          </div>

          <!-- Such-/Filterleiste -->
          <div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div class="relative min-w-[180px] flex-1">
              <AppIcon name="search" :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="handoverSearch"
                type="text"
                placeholder="Suche nach ID oder Text …"
                class="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <select
              v-model="handoverFilter"
              class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Alle</option>
              <option value="open">Nur offene</option>
              <option value="done">Nur übergebene</option>
            </select>
          </div>

          <!-- Batch-Übergabe mit Fortschritt -->
          <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <button
              class="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/50 dark:bg-slate-900/60 dark:text-blue-300"
              :disabled="handoverBatch !== null || jiraBusy || handoverPrepBusyId !== null"
              :title="settings.hasAtlassianConfig ? 'Alle sichtbaren offenen Anforderungen aufbereiten und in Jira anlegen' : 'Atlassian Cloud zuerst konfigurieren'"
              @click="handoverAll"
            >
              <AppIcon :name="handoverBatch ? 'loader-circle' : 'sparkles'" :size="14" :class="{ 'animate-spin': handoverBatch }" />
              {{ handoverBatch ? `Übergabe … ${handoverBatch.done} / ${handoverBatch.total}` : 'Alle sichtbaren übergeben' }}
            </button>
            <div v-if="handoverBatch" class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900/40">
              <div
                class="h-full rounded-full bg-blue-500 transition-all"
                :style="{ width: `${Math.round((handoverBatch.done / Math.max(handoverBatch.total, 1)) * 100)}%` }"
              />
            </div>
          </div>

          <!-- Anforderungsliste mit Vorschau -->
          <div
            v-for="req in handoverFiltered"
            :key="req.id"
            class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60"
          >
            <div class="p-4">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ req.id }}</span>
                  <span v-if="req.type" class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ req.type }}</span>
                  <span v-if="req.priority" class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">MoSCoW: {{ req.priority }}</span>
                  <span v-if="req.complexity" class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">Komplexität: {{ req.complexity }}</span>
                </div>
                <a
                  v-if="req.jiraKey"
                  :href="`https://${settings.atlassianDomain}/browse/${req.jiraKey}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  <AppIcon name="external-link" :size="12" /> {{ req.jiraKey }}
                </a>
              </div>

              <p class="mb-3 text-sm text-slate-700 dark:text-slate-200">{{ req.text }}</p>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
                  :disabled="handoverPrepBusyId === req.id"
                  @click="prepareHandoverDraft(req)"
                >
                  <AppIcon :name="handoverPrepBusyId === req.id ? 'loader-circle' : 'wand-sparkles'" :size="13" :class="{ 'animate-spin': handoverPrepBusyId === req.id }" />
                  {{ handoverPrepBusyId === req.id ? 'Bereite auf …' : (handoverDrafts[req.id] || req.jiraSummary) ? 'Neu aufbereiten' : 'Ticket vorbereiten' }}
                </button>

                <button
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  @click="toggleHandover(req)"
                >
                  <AppIcon :name="handoverExpanded[req.id] ? 'chevron-up' : 'pencil'" :size="13" />
                  {{ handoverExpanded[req.id] ? 'Vorschau schließen' : 'Vorschau & bearbeiten' }}
                </button>

                <button
                  v-if="!req.jiraKey"
                  class="inline-flex items-center gap-1.5 rounded-lg btn-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60"
                  :disabled="jiraBusy"
                  :title="settings.hasAtlassianConfig ? 'Ticket in Jira anlegen' : 'Atlassian Cloud zuerst konfigurieren'"
                  @click="createHandoverTicket(req)"
                >
                  <AppIcon :name="jiraBusyId === req.id ? 'loader-circle' : 'arrow-up-right'" :size="13" :class="{ 'animate-spin': jiraBusyId === req.id }" />
                  In Jira anlegen
                </button>
              </div>
            </div>

            <!-- Editierbare Vorschau -->
            <div
              v-if="handoverExpanded[req.id] && handoverDrafts[req.id]"
              class="space-y-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Titel (Summary)</label>
                  <input
                    v-model="handoverDrafts[req.id].summary"
                    type="text"
                    maxlength="255"
                    class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Issue-Type</label>
                  <select
                    v-model="handoverDrafts[req.id].issueType"
                    class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="Story">Story</option>
                    <option value="Task">Task</option>
                    <option value="Bug">Bug</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Beschreibung</label>
                <textarea
                  v-model="handoverDrafts[req.id].description"
                  class="custom-scrollbar h-40 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">
                Priorität wird aus MoSCoW ({{ req.priority || 'n/a' }}) abgeleitet. Labels: IREB-Typ &amp; Komplexität.
              </p>
            </div>
          </div>

          <p v-if="!handoverFiltered.length" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            Keine Anforderungen entsprechen den aktuellen Filtern.
          </p>
        </div>
        <p v-else class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          Noch keine Anforderungen vorhanden. Erstellen Sie zuerst User Stories (z. B. mit „Natürlichsprachlich") und priorisieren Sie im Backlog.
        </p>
      </template>

      <template v-else>
        <template v-if="isBacklogTool">
          <p class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
            Verwalten und schätzen Sie Ihre Anforderungen: Bewerten Sie jede einzeln oder gesammelt per KI mit Komplexität und MoSCoW. Die Übergabe nach Jira erfolgt anschließend im Schritt „Anforderung → Jira-Ticket".
          </p>

          <div class="mb-4 flex flex-wrap gap-3">
            <button
              class="inline-flex items-center gap-2 rounded-xl btn-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              :disabled="backlogBusy || !store.requirements.length"
              @click="estimateAllRequirements"
            >
              <AppIcon :name="backlogBusy ? 'loader-circle' : 'sparkles'" :size="16" :class="{ 'animate-spin': backlogBusy }" />
              Alle Storys schaetzen
            </button>
          </div>

          <div v-if="store.requirements.length" class="space-y-3">
            <div
              v-for="req in store.requirements"
              :key="req.id"
              class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div class="mb-2 flex items-center justify-between gap-3">
                <div class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ req.id }}</div>
                <div class="flex items-center gap-2 text-xs">
                  <span class="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Komplexitaet: {{ req.complexity || 'n/a' }}
                  </span>
                  <span class="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    MoSCoW: {{ req.priority || 'n/a' }}
                  </span>
                </div>
              </div>

              <p class="mb-3 text-sm text-slate-700 dark:text-slate-200">{{ req.text }}</p>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  :disabled="backlogBusy"
                  @click="estimateRequirement(req.id, req.text)"
                >
                  <AppIcon :name="backlogBusyId === req.id ? 'loader-circle' : 'sparkles'" :size="14" :class="{ 'animate-spin': backlogBusyId === req.id }" />
                  KI-Schaetzung
                </button>

                <a
                  v-if="req.jiraKey"
                  :href="`https://${settings.atlassianDomain}/browse/${req.jiraKey}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  <AppIcon name="external-link" :size="12" />
                  {{ req.jiraKey }}
                </a>
              </div>
            </div>
          </div>
          <p v-else class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            Noch keine Anforderungen vorhanden. Erstelle zuerst User Stories, z. B. mit "Natuerlichsprachlich".
          </p>
        </template>

        <template v-else>
          <textarea
            v-model="input"
            class="custom-scrollbar mb-4 h-40 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/80"
            placeholder="Ihre Eingabe …"
          />

          <PromptEditor :tool-id="toolId" :sub-key="selectedVariant" />

          <p
            v-if="isDemoMode"
            class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Demo-Modus aktiv: Dieser Lauf verwendet hinterlegte Beispielantworten statt eines API-Aufrufs.
          </p>

          <button
            class="flex w-full items-center justify-center gap-2 rounded-xl btn-brand py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-60"
            :disabled="loading"
            @click="run"
          >
            <AppIcon :name="loading ? 'loader-circle' : 'sparkles'" :size="18" :class="{ 'animate-spin': loading }" />
            {{ loading ? (isDemoMode ? 'Demo wird geladen …' : 'KI arbeitet …') : 'Mit KI ausführen' }}
          </button>
        </template>
      </template>

      <!-- Ergebnis -->
      <div v-if="result" class="relative mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60" aria-live="polite" :aria-busy="loading">
        <button
          class="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          @click="copyResult"
        >
          <AppIcon name="copy" :size="14" /> Kopieren
        </button>

        <MermaidView v-if="isModeling" :code="mermaidCode" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="markdown-body text-sm text-slate-700 dark:text-slate-200" v-html="renderMarkdown(result)" />

        <div v-if="recommendations.length" class="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
          <div class="mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span class="text-xs font-extrabold uppercase tracking-widest">Ergebnis gesichert</span>
          </div>

          <button
            class="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-700"
            @click="navigateToRecommendation(recommendations[0].toolId, recommendations[0].pillar)"
          >
            <AppIcon name="arrow-right" :size="16" />
            <span>Weiter im IREB-Prozess:</span>
            <span class="rounded-lg border border-emerald-400/20 bg-emerald-500/30 px-3 py-0.5 text-xs font-medium text-emerald-100">
              {{ recommendations[0].label }}
            </span>
          </button>

          <div class="my-5 flex items-center gap-4">
            <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Optionale Folgeschritte</span>
            <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              v-for="rec in recommendations"
              :key="`${rec.pillar}-${rec.toolId}`"
              class="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/70"
              @click="navigateToRecommendation(rec.toolId, rec.pillar)"
            >
              <div class="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 transition-all group-hover:border-emerald-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:group-hover:border-emerald-900/40 dark:group-hover:bg-emerald-950/30">
                <AppIcon :name="rec.icon" :size="16" />
              </div>
              <div class="flex-1">
                <div class="text-[12px] font-bold leading-snug text-slate-800 transition-colors group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-300">
                  {{ rec.label }}
                </div>
                <span
                  class="mt-1.5 inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  :class="{
                    'border-brand bg-brand-soft text-brand dark:text-brand-strong': rec.pillar === 'elicitation',
                    'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300': rec.pillar === 'documentation',
                    'border-teal-100 bg-teal-50 text-teal-600 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-300': rec.pillar === 'validation',
                    'border-purple-100 bg-purple-50 text-purple-600 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300': rec.pillar === 'management',
                  }"
                >
                  {{ rec.pillar === 'elicitation' ? '① Ermittlung' : rec.pillar === 'documentation' ? '② Dokumentation' : rec.pillar === 'validation' ? '③ Validierung' : '④ Management' }}
                </span>
              </div>
              <AppIcon name="arrow-up-right" :size="14" class="mt-0.5 shrink-0 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:text-slate-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
