import { defineStore } from 'pinia'
import type {
    AdvisorMessage,
    GlobalContext,
    GlossaryEntry,
    Requirement,
} from '@/types'

const STORAGE_KEY = 'ireb_project_state'

interface ProjectState {
    activeView: string
    openAccordion: string | null
    activeTab: string | null
    demoModeLoaded: boolean
    favorites: string[]
    requirements: Requirement[]
    glossary: GlossaryEntry[]
    completedSteps: string[]
    /** Vom Nutzer überschriebene Prompt-Muster: key = `${toolId}` bzw. `${toolId}_${subKey}` */
    customPrompts: Record<string, { system: string; user: string }>
    globalContext: GlobalContext
    advisorMessages: AdvisorMessage[]
    advisorAnswers: Record<string, string>
    advisorCurrentPhase: string
    advisorCompleted: boolean
    // Übergreifende Zwischenwerte (überleben Reload)
    tempVision: string
    tempPersonaText: string
    tempTranscript: string
    tempNote: string
    tempValReqText: string
    /** ID der Confluence-Seite nach erstem Sync (für Upsert bei Folgeaufrufen). */
    confluencePageId: string
}

interface DemoStoryFields {
    tempVision: string
    tempPersonaText: string
    tempTranscript: string
    tempNote: string
    tempValReqText: string
}

function supermarktDemoStory(): DemoStoryFields {
    return {
        tempVision:
            'Unsere Mitarbeiter verbringen zu viel Zeit damit, jeden Tag händisch nach abgelaufenen Lebensmitteln zu suchen. Wir brauchen eine App für die mobilen Handscanner. Die App soll anzeigen, wo Ware bald abläuft, damit wir sie direkt reduzieren können. Außerdem sollen Mitarbeiter darüber schnell fehlende Artikel (Out-of-Stock) ans Lager melden. Das Ganze muss an unser bestehendes Warenwirtschafts-System angebunden werden.',
        tempPersonaText:
            'Name: Klaus (48), Marktmitarbeiter Frische. Arbeitet unter hohem Zeitdruck, hat wenig IT-Erfahrung und nutzt täglich Handscanner. Schmerzpunkt: Sucht täglich per Hand nach Ablaufdaten.',
        tempTranscript:
            'Klaus: "Ich renne jeden Morgen durch die Gänge und lese auf jedem Joghurtbecher das Ablaufdatum ab. Das dauert ewig! Wenn ich einen Scanner hätte, der mir direkt sagt, wo bald etwas abläuft, und mir zeigt, wie stark ich es reduzieren muss (z.B. -30%), wäre mir sehr geholfen. Und wenn ein Fach leer ist, will ich es einfach per Scan dem Lager melden können. Aber im Kühlbereich haben wir oft kein WLAN!"',
        tempNote:
            'Scanner-App für MHD-Prüfung und Out-of-Stock-Meldung. Soll auf Zebra TC57 MDE-Geräten laufen. Muss offline funktionieren. Anbindung ans WWS.',
        tempValReqText:
            'Das System soll abgelaufene Ware möglichst schnell anzeigen und einfach meldbar machen.',
    }
}

function emptyContext(): GlobalContext {
    return { vision: '', personas: '', stakeholders: '', systemkontext: '' }
}

function emptyDraftFields(): DemoStoryFields {
    return {
        tempVision: '',
        tempPersonaText: '',
        tempTranscript: '',
        tempNote: '',
        tempValReqText: '',
    }
}

function firstRequirementFromResult(result: string): string {
    const parts = result
        .split(/\n\s*---\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
    return parts[0] ?? result.trim()
}

function splitRequirementBlocks(result: string): string[] {
    return result
        .split(/\n\s*---\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
}

function parseGlossaryTable(result: string): GlossaryEntry[] {
    return result
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('|') && !line.startsWith('|---'))
        .slice(1)
        .map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean))
        .filter((cells) => cells.length >= 2)
        .map(([term, definition]) => ({
            term: term.replace(/\*\*/g, ''),
            definition,
        }))
}

function isLegacyAutoDemoState(state: Partial<ProjectState>): boolean {
    const demo = supermarktDemoStory()
    return (
        state.demoModeLoaded === undefined &&
        state.tempVision === demo.tempVision &&
        state.tempPersonaText === demo.tempPersonaText &&
        state.tempTranscript === demo.tempTranscript &&
        state.tempNote === demo.tempNote &&
        state.tempValReqText === demo.tempValReqText
    )
}

/** Standardzustand ohne Vorbefüllung; Demo wird nur explizit geladen. */
function defaultState(): ProjectState {
    const emptyDrafts = emptyDraftFields()
    return {
        activeView: 'home',
        openAccordion: null,
        activeTab: null,
        demoModeLoaded: false,
        favorites: [],
        requirements: [],
        glossary: [],
        completedSteps: [],
        customPrompts: {},
        globalContext: emptyContext(),
        advisorMessages: [],
        advisorAnswers: {},
        advisorCurrentPhase: 'elicitation',
        advisorCompleted: false,
        confluencePageId: '',
        tempVision: emptyDrafts.tempVision,
        tempPersonaText: emptyDrafts.tempPersonaText,
        tempTranscript: emptyDrafts.tempTranscript,
        tempNote: emptyDrafts.tempNote,
        tempValReqText: emptyDrafts.tempValReqText,
    }
}

export const useProjectStore = defineStore('project', {
    state: (): ProjectState => defaultState(),

    getters: {
        nextReqId(state): string {
            const max = state.requirements.reduce((acc, r) => {
                const num = parseInt(r.id.replace(/\D/g, ''), 10)
                return Number.isNaN(num) ? acc : Math.max(acc, num)
            }, 0)
            return `REQ-${String(max + 1).padStart(3, '0')}`
        },
    },

    actions: {
        /** Lädt persistierten Zustand aus dem localStorage (nur sichere Felder). */
        load() {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (!saved) return
            try {
                const p = JSON.parse(saved) as Partial<ProjectState>
                this.requirements = p.requirements ?? []
                this.glossary = p.glossary ?? []
                this.favorites = p.favorites ?? []
                this.activeTab = p.activeTab ?? null
                this.completedSteps = p.completedSteps ?? []
                this.customPrompts = p.customPrompts ?? {}
                this.globalContext = p.globalContext ?? emptyContext()
                this.advisorMessages = p.advisorMessages ?? []
                this.advisorAnswers = p.advisorAnswers ?? {}
                this.advisorCurrentPhase = p.advisorCurrentPhase ?? 'elicitation'
                this.advisorCompleted = p.advisorCompleted ?? false
                this.demoModeLoaded = p.demoModeLoaded ?? false
                this.confluencePageId = p.confluencePageId ?? ''

                if (isLegacyAutoDemoState(p)) {
                    const emptyDrafts = emptyDraftFields()
                    this.tempVision = emptyDrafts.tempVision
                    this.tempPersonaText = emptyDrafts.tempPersonaText
                    this.tempTranscript = emptyDrafts.tempTranscript
                    this.tempNote = emptyDrafts.tempNote
                    this.tempValReqText = emptyDrafts.tempValReqText
                    this.save()
                    return
                }

                if (p.tempVision !== undefined) this.tempVision = p.tempVision
                if (p.tempPersonaText !== undefined) this.tempPersonaText = p.tempPersonaText
                if (p.tempTranscript !== undefined) this.tempTranscript = p.tempTranscript
                if (p.tempNote !== undefined) this.tempNote = p.tempNote
                if (p.tempValReqText !== undefined) this.tempValReqText = p.tempValReqText
            } catch {
                // Beschädigter State wird ignoriert und mit Defaults überschrieben.
            }
        },

        /** Schreibt den aktuellen Zustand in den localStorage. */
        save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
        },

        /** Setzt das gesamte Projekt zurück (außer API-Einstellungen). */
        reset() {
            this.$patch(defaultState())
            this.save()
        },

        /** Lädt die Supermarkt-Story explizit in alle Demo-Eingabefelder und speichert den Zustand. */
        loadSupermarktDemo() {
            const demo = supermarktDemoStory()
            this.demoModeLoaded = true
            this.tempVision = demo.tempVision
            this.tempPersonaText = demo.tempPersonaText
            this.tempTranscript = demo.tempTranscript
            this.tempNote = demo.tempNote
            this.tempValReqText = demo.tempValReqText
            this.save()
        },

        applyToolResult(toolId: string, input: string, result: string, subKey?: string) {
            switch (toolId) {
                case 'goals':
                case 'context':
                case 'stakeholder':
                    this.tempVision = input
                    this.globalContext.vision = input
                    break
                default:
                    break
            }

            switch (toolId) {
                case 'context':
                    this.globalContext.systemkontext = result
                    break
                case 'stakeholder':
                    this.globalContext.stakeholders = result
                    break
                case 'persona':
                    this.globalContext.personas = result
                    this.tempPersonaText = result
                    break
                case 'prep':
                    if (subKey === 'simulation') {
                        this.tempTranscript = result
                    }
                    break
                case 'extract_req':
                    this.tempTranscript = input
                    this.tempNote = result
                    break
                case 'formulate':
                    this.tempNote = input
                    this.tempValReqText = firstRequirementFromResult(result)
                    for (const requirementText of splitRequirementBlocks(result)) {
                        if (!this.requirements.some((req) => req.text === requirementText)) {
                            this.requirements.push({ id: this.nextReqId, text: requirementText })
                        }
                    }
                    break
                case 'glossary_extract': {
                    const glossaryEntries = parseGlossaryTable(result)
                    if (glossaryEntries.length) {
                        this.glossary = glossaryEntries
                    }
                    break
                }
                case 'smells':
                case 'tests':
                case 'perspective':
                case 'conflict':
                case 'devil':
                case 'compliance':
                case 'dor':
                case 'bva':
                case 'nfr':
                    this.tempValReqText = input
                    break
                default:
                    break
            }

            this.save()
        },

        addRequirement(text: string, type?: string): Requirement {
            const req: Requirement = { id: this.nextReqId, text, type }
            this.requirements.push(req)
            this.save()
            return req
        },

        deleteRequirement(id: string) {
            this.requirements = this.requirements.filter((r) => r.id !== id)
            this.save()
        },

        setRequirementEstimation(id: string, complexity: string, priority: string) {
            const req = this.requirements.find((item) => item.id === id)
            if (!req) return
            req.complexity = complexity
            req.priority = priority
            this.save()
        },

        setRequirementJiraKey(id: string, jiraKey: string) {
            const req = this.requirements.find((item) => item.id === id)
            if (!req) return
            req.jiraKey = jiraKey
            this.save()
        },

        setConfluencePageId(pageId: string) {
            this.confluencePageId = pageId
            this.save()
        },

        toggleFavorite(toolId: string) {
            const idx = this.favorites.indexOf(toolId)
            if (idx >= 0) this.favorites.splice(idx, 1)
            else this.favorites.push(toolId)
            this.save()
        },

        setView(view: string, accordion: string | null = null) {
            this.activeView = view
            if (accordion !== null) this.openAccordion = accordion
            this.activeTab = null
        },

        setCustomPrompt(key: string, value: { system: string; user: string }) {
            this.customPrompts[key] = value
            this.save()
        },

        clearCustomPrompt(key: string) {
            delete this.customPrompts[key]
            this.save()
        },

        addAdvisorMessage(message: AdvisorMessage) {
            this.advisorMessages.push(message)
            this.save()
        },

        clearAdvisorMessages() {
            this.advisorMessages = []
            this.save()
        },

        setAdvisorAnswer(key: string, value: string) {
            this.advisorAnswers[key] = value
            this.save()
        },

        setAdvisorPhase(phase: string) {
            this.advisorCurrentPhase = phase
            this.save()
        },

        setAdvisorCompleted(completed: boolean) {
            this.advisorCompleted = completed
            this.save()
        },

        clearAdvisorState() {
            this.advisorMessages = []
            this.advisorAnswers = {}
            this.advisorCurrentPhase = 'elicitation'
            this.advisorCompleted = false
            this.save()
        },
    },
})
