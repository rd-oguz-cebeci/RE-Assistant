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
    favorites: string[]
    requirements: Requirement[]
    glossary: GlossaryEntry[]
    completedSteps: string[]
    /** Vom Nutzer überschriebene Prompt-Muster: key = `${toolId}` bzw. `${toolId}_${subKey}` */
    customPrompts: Record<string, { system: string; user: string }>
    globalContext: GlobalContext
    advisorMessages: AdvisorMessage[]
    // Übergreifende Zwischenwerte (überleben Reload) – Demo-Daten vorbefüllt
    tempVision: string
    tempPersonaText: string
    tempTranscript: string
    tempNote: string
    tempValReqText: string
}

function emptyContext(): GlobalContext {
    return { vision: '', personas: '', stakeholders: '', systemkontext: '' }
}

/** Demo-Plot: Supermarkt-Scanner-App (aus der Ursprungs-App übernommen). */
function defaultState(): ProjectState {
    return {
        activeView: 'home',
        openAccordion: null,
        activeTab: null,
        favorites: [],
        requirements: [],
        glossary: [],
        completedSteps: [],
        customPrompts: {},
        globalContext: emptyContext(),
        advisorMessages: [],
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
    },
})
