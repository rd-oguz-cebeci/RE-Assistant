import type { GlossaryEntry, Requirement } from '@/types'
import { useProjectStore } from '@/stores/project'

function escapeTableCell(value: string): string {
    return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function formatRequirementsTable(requirements: Requirement[]): string {
    if (requirements.length === 0) return ''

    let md = '## Anforderungen (Backlog)\n'
    md += '| ID | Anforderung | Typ | Priorität | Komplexität |\n'
    md += '|---|---|---|---|---|\n'

    for (const requirement of requirements) {
        md += `| ${escapeTableCell(requirement.id)} | ${escapeTableCell(requirement.text)} | ${escapeTableCell(requirement.type ?? '-')} | ${escapeTableCell(requirement.priority ?? '-')} | ${escapeTableCell(requirement.complexity ?? '-')} |\n`
    }

    md += '\n'
    return md
}

function formatGlossaryTable(glossary: GlossaryEntry[]): string {
    if (glossary.length === 0) return ''

    let md = '## Glossar\n'
    md += '| Begriff | Definition |\n'
    md += '|---|---|\n'

    for (const entry of glossary) {
        md += `| ${escapeTableCell(entry.term)} | ${escapeTableCell(entry.definition)} |\n`
    }

    md += '\n'
    return md
}

export function serializeProjectExport(): string {
    const store = useProjectStore()
    const exportedAt = new Date().toLocaleString('de-DE')

    const machineSnapshot = {
        demoModeLoaded: store.demoModeLoaded,
        activeView: store.activeView,
        globalContext: store.globalContext,
        drafts: {
            vision: store.tempVision,
            personaText: store.tempPersonaText,
            transcript: store.tempTranscript,
            note: store.tempNote,
            validationRequirement: store.tempValReqText,
        },
        glossary: store.glossary,
        requirements: store.requirements,
        favorites: store.favorites,
    }

    let md = '# RE-Projektkontext\n'
    md += `> Exportiert am: ${exportedAt}\n`
    md += `> Quelle: IREB RE AI Assistant (Demo-Modus: ${store.demoModeLoaded ? 'Ja' : 'Nein'})\n`
    md += '> Verwendungszweck: Import in Claude Code oder andere KI-Werkzeuge als Projektkontext\n\n'

    if (store.globalContext.vision || store.tempVision) {
        md += `## Projektvision\n${store.globalContext.vision || store.tempVision}\n\n`
    }

    if (store.globalContext.systemkontext) {
        md += `## Systemkontext\n${store.globalContext.systemkontext}\n\n`
    }

    if (store.globalContext.stakeholders) {
        md += `## Stakeholder\n${store.globalContext.stakeholders}\n\n`
    }

    if (store.globalContext.personas || store.tempPersonaText) {
        md += `## Personas\n${store.globalContext.personas || store.tempPersonaText}\n\n`
    }

    if (store.tempTranscript) {
        md += `## Interview / Rohtext\n${store.tempTranscript}\n\n`
    }

    if (store.tempNote) {
        md += `## Arbeitsnotizen / Extraktion\n${store.tempNote}\n\n`
    }

    if (store.tempValReqText) {
        md += `## Fokus-Anforderung für Validierung\n${store.tempValReqText}\n\n`
    }

    md += formatGlossaryTable(store.glossary)
    md += formatRequirementsTable(store.requirements)

    if (store.favorites.length > 0) {
        md += '## Favorisierte Werkzeuge\n'
        for (const favorite of store.favorites) {
            md += `- ${favorite}\n`
        }
        md += '\n'
    }

    md += '## Import-Hinweis für Claude Code\n'
    md += '- Verwende diesen Inhalt als Projektkontext fuer Requirements Engineering, Stakeholder, Systemkontext, Glossar und Backlog.\n'
    md += '- Behandle die Tabelle `Anforderungen (Backlog)` als priorisierte Grundlage fuer weitere Ableitungen, Validierung und Management.\n'
    md += '- Nutze die folgenden JSON-Rohdaten nur fuer maschinelle Weiterverarbeitung.\n\n'

    md += '## Maschinenlesbarer Snapshot\n'
    md += '```json\n'
    md += `${JSON.stringify(machineSnapshot, null, 2)}\n`
    md += '```\n'

    return md
}

export function downloadProjectExport(fileName = 're-context.md') {
    const markdown = serializeProjectExport()
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
}