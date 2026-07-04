// Zentrale Typdefinitionen für die Menü-/Werkzeug-Konfiguration und den State.

/** Prompt-Patterns können entweder ein einzelnes Muster oder mehrere
 *  benannte Varianten (z. B. verschiedene Diagrammtypen) sein. */
export type PromptPatterns = Record<string, string>

/** Ein einzelnes Werkzeug innerhalb einer Methodik-Säule. */
export interface Tool {
    id: string
    category?: string
    icon: string
    label: string
    desc: string
    instruction: string
    why: string
    /** Standard-Prompt-Muster (Editor zeigt es an, KI nutzt es). */
    promptPattern?: string
    /** Mehrere benannte Prompt-Varianten (z. B. UML-Diagrammtypen). */
    promptPatterns?: PromptPatterns
}

/** Eine der vier IREB-Säulen (Ermittlung, Dokumentation, Validierung, Management). */
export interface MenuSection {
    id: string
    icon: string
    color: string
    label: string
    title: string
    desc: string
    instruction: string
    why: string
    children: Tool[]
}

export type AiProvider = 'gemini' | 'anthropic'

/** Eine dokumentierte Anforderung im Backlog. */
export interface Requirement {
    id: string
    text: string
    type?: string
    complexity?: string
    priority?: string
    /** Jira-Issue-Key nach dem Sync, z. B. "REQ-42". */
    jiraKey?: string
}

/** Glossar-Eintrag (Single Source of Truth für Fachbegriffe). */
export interface GlossaryEntry {
    term: string
    definition: string
}

/** Globaler, über Werkzeuge hinweg geteilter Projektkontext (Prompt-Chaining). */
export interface GlobalContext {
    vision: string
    personas: string
    stakeholders: string
    systemkontext: string
}

/** Nachricht im IREB-Berater-Chat. */
export interface AdvisorMessage {
    role: 'user' | 'assistant'
    text: string
}
