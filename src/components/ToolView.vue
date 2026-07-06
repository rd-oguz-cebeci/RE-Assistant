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
import { createJiraIssue, syncProjectToConfluence, getJiraProjectIssues, getJiraProjectByKey, getJiraIssueDetail, AtlassianError } from '@/services/atlassian'
import type { JiraProjectIssue } from '@/services/atlassian'
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

// Jira Quality tool state
const jiraQualityIssues = ref<JiraProjectIssue[]>([])
const jiraQualityBusy = ref(false)
const jiraQualityCheckBusy = ref<string | null>(null)
const jiraQualityResults = ref<Record<string, string>>({})

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

async function pushRequirementToJira(reqId: string) {
  const req = store.requirements.find((r) => r.id === reqId)
  if (!req) return

  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen (Schlüssel-Symbol) konfigurieren.', 'error')
    return
  }

  jiraBusy.value = true
  jiraBusyId.value = reqId
  try {
    const issue = await createJiraIssue(buildAtlassianConfig(), req)
    store.setRequirementJiraKey(reqId, issue.key)
    show(`Jira-Issue erstellt: ${issue.key}`, 'success')
  } catch (error) {
    const msg = error instanceof AtlassianError ? error.message : 'Jira-Push fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    jiraBusy.value = false
    jiraBusyId.value = null
  }
}

async function pushAllRequirementsToJira() {
  const unpushed = store.requirements.filter((r) => !r.jiraKey)
  if (!unpushed.length) {
    show('Alle Anforderungen sind bereits in Jira vorhanden.', 'error')
    return
  }

  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen konfigurieren.', 'error')
    return
  }

  jiraBusy.value = true
  jiraBusyId.value = null
  let successCount = 0
  try {
    for (const req of unpushed) {
      const issue = await createJiraIssue(buildAtlassianConfig(), req)
      store.setRequirementJiraKey(req.id, issue.key)
      successCount++
    }
    show(`${successCount} Anforderung${successCount !== 1 ? 'en' : ''} nach Jira exportiert.`, 'success')
  } catch (error) {
    const msg = error instanceof AtlassianError ? error.message : 'Jira-Push fehlgeschlagen.'
    show(`${successCount} erfolgreich, dann Fehler: ${msg}`, 'error')
  } finally {
    jiraBusy.value = false
  }
}

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

function formatDate(value: string): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('de-DE')
}

function toMarkdownDashboard(issues: Awaited<ReturnType<typeof getJiraProjectIssues>>): string {
  const total = issues.length
  const doneStates = ['done', 'erledigt', 'closed', 'abgeschlossen']
  const inProgressStates = ['in progress', 'in arbeit', 'progress', 'coding', 'review']
  const todoStates = ['to do', 'offen', 'open', 'backlog']

  const done = issues.filter((i) => doneStates.some((s) => i.status.toLowerCase().includes(s))).length
  const inProgress = issues.filter((i) => inProgressStates.some((s) => i.status.toLowerCase().includes(s))).length
  const todo = issues.filter((i) => todoStates.some((s) => i.status.toLowerCase().includes(s))).length
  const unknown = total - done - inProgress - todo

  const blocked = issues.filter((i) => /block|blocked|impediment|stuck/i.test(i.summary)).slice(0, 5)
  const linkedJiraKeys = new Set(store.requirements.map((req) => req.jiraKey).filter(Boolean))
  const linkedIssues = issues.filter((issue) => linkedJiraKeys.has(issue.key))
  const unlinkedIssues = issues.filter((issue) => !linkedJiraKeys.has(issue.key)).slice(0, 10)
  const reviewCandidates = issues
    .filter((issue) => {
      const summary = issue.summary.trim()
      return (
        summary.length < 25 ||
        /\b(todo|tbd|unklar|divers|misc|fix|anpassen|optimieren|verbessern|schnell|einfach)\b/i.test(summary) ||
        !/(muss|soll|kann|als |damit|wenn|falls|user story|akzeptanz|acceptance)/i.test(summary)
      )
    })
    .slice(0, 10)

  const statusBuckets = new Map<string, number>()
  const priorityBuckets = new Map<string, number>()
  for (const issue of issues) {
    statusBuckets.set(issue.status, (statusBuckets.get(issue.status) ?? 0) + 1)
    priorityBuckets.set(issue.priority, (priorityBuckets.get(issue.priority) ?? 0) + 1)
  }

  const statusRows = Array.from(statusBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join('\n')

  const prioRows = Array.from(priorityBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([prio, count]) => `| ${prio} | ${count} |`)
    .join('\n')

  const topUpdated = [...issues]
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
    .slice(0, 8)
    .map((i) => `| [${i.key}](${i.url}) | ${i.issueType} | ${i.status} | ${i.priority} | ${i.assignee} | ${formatDate(i.updated)} |`)
    .join('\n')

  const blockedSection = blocked.length
    ? blocked.map((i) => `- [${i.key}](${i.url}) - ${i.summary}`).join('\n')
    : '- Keine offensichtlichen Blocker anhand Titelstichwörtern gefunden.'

  const unlinkedSection = unlinkedIssues.length
    ? unlinkedIssues.map((i) => `- [${i.key}](${i.url}) - ${i.summary}`).join('\n')
    : '- Alle geladenen Jira-Tickets sind mit Anforderungen im RE-Assistenten verknüpft.'

  const reviewSection = reviewCandidates.length
    ? reviewCandidates.map((i) => `- [${i.key}](${i.url}) - ${i.summary}`).join('\n')
    : '- Keine offensichtlichen Review-Kandidaten anhand der Ticket-Titel gefunden.'

  const traceabilityPercent = total > 0 ? Math.round((linkedIssues.length / total) * 100) : 0

  return [
    '# Jira RE-Health Dashboard',
    '',
    `Projekt: **${settings.atlassianJiraProject}**`,
    `Stand: **${new Date().toLocaleString('de-DE')}**`,
    '',
    '## RE-Health Übersicht',
    '',
    `- Gesamt-Tickets: **${total}**`,
    `- Mit RE-Anforderung verknüpft: **${linkedIssues.length}** (${traceabilityPercent}%)`,
    `- Ohne RE-Traceability: **${Math.max(total - linkedIssues.length, 0)}**`,
    `- Review-Kandidaten: **${reviewCandidates.length}**`,
    `- Done: **${done}**`,
    `- In Progress: **${inProgress}**`,
    `- To Do: **${todo}**`,
    `- Unklassifiziert: **${unknown}**`,
    '',
    '## Traceability-Lücken',
    '',
    unlinkedSection,
    '',
    '## Kandidaten für IREB-Review',
    '',
    reviewSection,
    '',
    '## Status-Verteilung',
    '',
    '| Status | Anzahl |',
    '|---|---:|',
    statusRows || '| - | 0 |',
    '',
    '## Prioritäten',
    '',
    '| Priorität | Anzahl |',
    '|---|---:|',
    prioRows || '| - | 0 |',
    '',
    '## Zuletzt aktualisierte Tickets',
    '',
    '| Ticket | Typ | Status | Priorität | Assignee | Updated |',
    '|---|---|---|---|---|---|',
    topUpdated || '| - | - | - | - | - | - |',
    '',
    '## Potenzielle Blocker',
    '',
    blockedSection,
  ].join('\n')
}

async function refreshJiraDashboard() {
  if (!settings.hasAtlassianConfig) {
    show('Bitte zuerst Atlassian Cloud in den Einstellungen konfigurieren.', 'error')
    return
  }

  jiraDashboardBusy.value = true
  try {
    const issues = await getJiraProjectIssues(buildAtlassianConfig(), 120)
    result.value = toMarkdownDashboard(issues)

    if (issues.length === 0) {
      const currentKey = settings.atlassianJiraProject.trim().toUpperCase()
      const currentProject = await getJiraProjectByKey(buildAtlassianConfig(), currentKey)
      const currentExists = Boolean(currentProject)

      if (!currentExists) {
        show(`0 Tickets: Projekt '${currentKey}' ist per API für den Token nicht sichtbar (oder Key falsch).`, 'error')
      } else {
        show(`Dashboard aktualisiert (0 Tickets im Projekt ${currentKey} - ${currentProject?.name}).`, 'success')
      }
      return
    }

    show(`Dashboard aktualisiert (${issues.length} Tickets).`, 'success')
  } catch (error) {
    const msg = error instanceof AtlassianError ? error.message : 'Dashboard konnte nicht geladen werden.'
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
    jiraQualityIssues.value = await getJiraProjectIssues(buildAtlassianConfig(), 50)
    jiraQualityResults.value = {}
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
      'Du bist ein IREB-zertifizierter Requirements Engineer. Prüfe das folgende Jira-Ticket auf Anforderungsqualität. Bewerte: 1. Klarheit und Eindeutigkeit (Smells, Weichmacher, Passiv-Konstruktionen), 2. Vollständigkeit (fehlende Bedingungen, Akteure, Prozessworte), 3. Testbarkeit (sind Abnahmekriterien ableitbar?), 4. IREB-Qualitätskriterien: Adäquat, Notwendig, Eindeutig, Vollständig, Prüfbar. Erstelle eine Checkliste mit ✅/❌ und konkreten Verbesserungsvorschlägen. Format: Markdown.'
    const userPrompt = `Jira-Ticket:\n${ticketText}`

    let aiResult: string
    if (isDemoMode.value) {
      aiResult = getDemoResponse('smells', ticketText, undefined)
    } else {
      aiResult = await callAi(userPrompt, systemPrompt)
    }

    jiraQualityResults.value = { ...jiraQualityResults.value, [issue.key]: aiResult }
    show(`Qualitätsprüfung für ${issue.key} abgeschlossen.`, 'success')
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Qualitätsprüfung fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    jiraQualityCheckBusy.value = null
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
          Liest aktuelle Jira-Tickets ein und erzeugt ein RE-Health-Dashboard mit Traceability,
          Review-Kandidaten, Statusverteilung und potenziellen Blockern.
        </p>

        <button
          class="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
          :disabled="jiraDashboardBusy"
          @click="refreshJiraDashboard"
        >
          <AppIcon :name="jiraDashboardBusy ? 'loader-circle' : 'activity'" :size="18" :class="{ 'animate-spin': jiraDashboardBusy }" />
          {{ jiraDashboardBusy ? 'Dashboard wird aktualisiert …' : 'RE-Health aktualisieren' }}
        </button>
      </template>

      <template v-else-if="isJiraQualityTool">
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Laden Sie Jira-Tickets aus Ihrem Projekt und lassen Sie die KI jeden Ticket-Text gegen IREB-Qualitätskriterien prüfen.
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
          <div
            v-for="issue in jiraQualityIssues"
            :key="issue.key"
            class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60"
          >
            <div class="mb-2 flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <a
                  :href="issue.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs font-bold uppercase tracking-wider text-blue-600 hover:underline dark:text-blue-400"
                >
                  {{ issue.key }}
                </a>
                <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ issue.issueType }}</span>
                <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ issue.status }}</span>
              </div>
              <button
                class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                :disabled="jiraQualityCheckBusy === issue.key"
                @click="checkJiraTicketQuality(issue)"
              >
                <AppIcon :name="jiraQualityCheckBusy === issue.key ? 'loader-circle' : 'search-check'" :size="12" :class="{ 'animate-spin': jiraQualityCheckBusy === issue.key }" />
                {{ jiraQualityCheckBusy === issue.key ? 'Prüfung läuft …' : 'Qualität prüfen' }}
              </button>
            </div>
            <p class="mb-3 text-sm text-slate-700 dark:text-slate-200">{{ issue.summary }}</p>

            <div v-if="jiraQualityResults[issue.key]" class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="markdown-body text-sm text-slate-700 dark:text-slate-200" v-html="renderMarkdown(jiraQualityResults[issue.key])" />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <template v-if="isBacklogTool">
          <p class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
            Hier sehen Sie alle vorhandenen User Stories/Anforderungen. Sie koennen jede einzeln oder gesammelt per KI mit Komplexitaet und MoSCoW bewerten.
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

            <button
              class="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
              :disabled="jiraBusy || !store.requirements.length"
              :title="settings.hasAtlassianConfig ? 'Alle noch nicht übergebenen Anforderungen als Jira-Issues anlegen' : 'Atlassian Cloud zuerst konfigurieren'"
              @click="pushAllRequirementsToJira"
            >
              <AppIcon :name="jiraBusy && !jiraBusyId ? 'loader-circle' : 'arrow-up-right'" :size="16" :class="{ 'animate-spin': jiraBusy && !jiraBusyId }" />
              Jira-Übergabe
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
                  class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
                >
                  <AppIcon name="external-link" :size="12" />
                  {{ req.jiraKey }}
                </a>
                <button
                  v-else
                  class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
                  :disabled="jiraBusy"
                  @click="pushRequirementToJira(req.id)"
                >
                  <AppIcon :name="jiraBusyId === req.id ? 'loader-circle' : 'arrow-up-right'" :size="14" :class="{ 'animate-spin': jiraBusyId === req.id }" />
                  Nach Jira übergeben
                </button>
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
