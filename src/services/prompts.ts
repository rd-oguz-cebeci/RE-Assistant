import { findTool } from '@/config/menu'
import { useProjectStore } from '@/stores/project'

export interface ResolvedPrompt {
    system: string
    user: string
}

/** Zerlegt ein Prompt-Muster in System- und User-Teil. */
export function parsePromptPattern(pattern: string): ResolvedPrompt {
    if (!pattern) return { system: '', user: '' }
    const sysIndex = pattern.indexOf('System-Prompt:')
    const userIndex = pattern.indexOf('User-Prompt:')
    if (sysIndex !== -1 && userIndex !== -1) {
        return {
            system: pattern.substring(sysIndex + 14, userIndex).trim(),
            user: pattern.substring(userIndex + 12).trim(),
        }
    }
    if (sysIndex !== -1) {
        return { system: pattern.substring(sysIndex + 14).trim(), user: '' }
    }
    return { system: pattern.trim(), user: '' }
}

/** Cache-Schlüssel für (optional varianten-spezifische) Custom-Prompts. */
export function cacheKey(toolId: string, subKey?: string): string {
    return subKey ? `${toolId}_${subKey}` : toolId
}

/** Liefert das (ggf. vom Nutzer angepasste) Standard-Prompt-Muster eines Werkzeugs. */
export function getDefaultPrompt(toolId: string, subKey?: string): ResolvedPrompt {
    const found = findTool(toolId)
    if (!found) return { system: '', user: '' }
    const { tool } = found
    const pattern =
        (subKey && tool.promptPatterns?.[subKey]) || tool.promptPattern || ''
    return parsePromptPattern(pattern)
}

const INPUT_PLACEHOLDERS =
    /\[Eingabe[^\]]*\]|\[Rohtext\]|\[Projektidee\]|\[Kontext\]|\[Gewählte Anforderung\]|\[Anforderung\]|\[Thema\]|\[Code\/Text\]|\[Eingabe Text\]|\[Prozess\]|\[Transkript\]/gi

function escapeRegExp(value: string): string {
    return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

/**
 * Berechnet die effektiven System-/User-Prompts für ein Werkzeug:
 * berücksichtigt Custom-Prompts, ersetzt Eingabe-Platzhalter und beliebige
 * benannte Variablen ([Name] → Wert).
 */
export function getEffectivePrompts(
    toolId: string,
    inputVal = '',
    varMap: Record<string, string> = {},
    subKey?: string,
): ResolvedPrompt {
    const store = useProjectStore()
    const key = cacheKey(toolId, subKey)
    const base = store.customPrompts[key] ?? getDefaultPrompt(toolId, subKey)

    let system = base.system
    let user = base.user.replace(INPUT_PLACEHOLDERS, inputVal)

    for (const [name, value] of Object.entries(varMap)) {
        const regex = new RegExp(`\\[${escapeRegExp(name)}\\]`, 'gi')
        system = system.replace(regex, value)
        user = user.replace(regex, value)
    }

    // Falls das Muster keinen User-Teil hatte, die reine Eingabe verwenden.
    if (!user.trim()) user = inputVal

    return { system, user }
}
