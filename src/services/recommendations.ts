export interface ToolRecommendation {
    toolId: string
    label: string
    icon: string
    pillar: 'elicitation' | 'documentation' | 'validation' | 'management'
}

const RECOMMENDATIONS: Record<string, ToolRecommendation[]> = {
    goals: [
        { toolId: 'context', label: 'Systemkontext definieren', icon: 'box-select', pillar: 'elicitation' },
        { toolId: 'stakeholder', label: 'Stakeholder-Radar erstellen', icon: 'radar', pillar: 'elicitation' },
    ],
    matrix: [
        { toolId: 'context', label: 'Systemkontext definieren', icon: 'box-select', pillar: 'elicitation' },
        { toolId: 'stakeholder', label: 'Stakeholder-Radar erstellen', icon: 'radar', pillar: 'elicitation' },
    ],
    stakeholder: [
        { toolId: 'persona', label: 'Stakeholder-Personas ableiten', icon: 'users', pillar: 'elicitation' },
        { toolId: 'prep', label: 'Interview-Leitfaden entwerfen', icon: 'mic', pillar: 'elicitation' },
    ],
    persona: [
        { toolId: 'prep', label: 'Interview-Leitfaden entwerfen', icon: 'mic', pillar: 'elicitation' },
        { toolId: 'kano', label: 'Kano-Klassifikation durchführen', icon: 'help-circle', pillar: 'elicitation' },
    ],
    questionnaire: [
        { toolId: 'context', label: 'Systemkontext definieren', icon: 'box-select', pillar: 'elicitation' },
        { toolId: 'kano', label: 'Kano-Klassifikation durchführen', icon: 'help-circle', pillar: 'elicitation' },
    ],
    apprenticing: [
        { toolId: 'extract_req', label: 'Anforderungen extrahieren', icon: 'zap', pillar: 'documentation' },
        { toolId: 'formulate', label: 'Anforderungen sauber formulieren', icon: 'file-edit', pillar: 'documentation' },
    ],
    archaeology: [
        { toolId: 'extract_req', label: 'Anforderungen extrahieren', icon: 'zap', pillar: 'documentation' },
        { toolId: 'context', label: 'Systemkontext definieren', icon: 'box-select', pillar: 'elicitation' },
    ],
    scamper: [
        { toolId: 'kano', label: 'Kano-Klassifikation durchführen', icon: 'help-circle', pillar: 'elicitation' },
        { toolId: 'workshop', label: 'RE Workshop planen', icon: 'presentation', pillar: 'elicitation' },
    ],
    context: [
        { toolId: 'stakeholder', label: 'Stakeholder-Radar erstellen', icon: 'radar', pillar: 'elicitation' },
        { toolId: 'prep', label: 'Interview-Leitfaden entwerfen', icon: 'mic', pillar: 'elicitation' },
    ],
    prep: [
        { toolId: 'prep', label: 'Interview simulieren (Rollenspiel)', icon: 'bot', pillar: 'elicitation' },
        { toolId: 'kano', label: 'Kano-Klassifikation durchführen', icon: 'help-circle', pillar: 'elicitation' },
    ],
    'prep:simulation': [
        { toolId: 'extract_req', label: 'Anforderungen extrahieren', icon: 'zap', pillar: 'documentation' },
        { toolId: 'formulate', label: 'Anforderungen sauber formulieren', icon: 'file-edit', pillar: 'documentation' },
    ],
    kano: [
        { toolId: 'extract_req', label: 'Anforderungen extrahieren', icon: 'zap', pillar: 'documentation' },
        { toolId: 'nfr', label: 'NFRs ableiten', icon: 'shield-check', pillar: 'documentation' },
    ],
    workshop: [
        { toolId: 'extract_req', label: 'Anforderungen extrahieren', icon: 'zap', pillar: 'documentation' },
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
    ],
    extract_req: [
        { toolId: 'formulate', label: 'Anforderungen sauber formulieren', icon: 'file-edit', pillar: 'documentation' },
        { toolId: 'modeling', label: 'UML-Modellierung erstellen', icon: 'network', pillar: 'documentation' },
    ],
    formulate: [
        { toolId: 'nfr', label: 'NFRs ableiten', icon: 'shield-check', pillar: 'documentation' },
        { toolId: 'glossary_extract', label: 'Glossar-Begriffe extrahieren', icon: 'search', pillar: 'documentation' },
    ],
    nfr: [
        { toolId: 'glossary_extract', label: 'Glossar-Begriffe extrahieren', icon: 'search', pillar: 'documentation' },
        { toolId: 'modeling', label: 'UML-Modellierung erstellen', icon: 'network', pillar: 'documentation' },
    ],
    glossary_extract: [
        { toolId: 'glossary_manage', label: 'Projekt-Glossar pflegen', icon: 'book-open', pillar: 'documentation' },
        { toolId: 'smells', label: 'Smells-Check starten', icon: 'search-check', pillar: 'validation' },
    ],
    glossary_manage: [
        { toolId: 'modeling', label: 'UML-Modellierung erstellen', icon: 'network', pillar: 'documentation' },
        { toolId: 'smells', label: 'Smells-Check starten', icon: 'search-check', pillar: 'validation' },
    ],
    modeling: [
        { toolId: 'tests', label: 'Abnahmekriterien ableiten', icon: 'beaker', pillar: 'validation' },
        { toolId: 'smells', label: 'Smells-Check starten', icon: 'search-check', pillar: 'validation' },
    ],
    smells: [
        { toolId: 'tests', label: 'Abnahmekriterien ableiten', icon: 'beaker', pillar: 'validation' },
        { toolId: 'dor', label: 'Ready-Check durchführen', icon: 'list-checks', pillar: 'validation' },
    ],
    tests: [
        { toolId: 'perspective', label: 'Review-Perspektiven simulieren', icon: 'eye', pillar: 'validation' },
        { toolId: 'devil', label: 'Teufelsadvokat befragen', icon: 'alert-triangle', pillar: 'validation' },
    ],
    perspective: [
        { toolId: 'conflict', label: 'Konflikt-Analyse starten', icon: 'git-merge', pillar: 'validation' },
        { toolId: 'compliance', label: 'Compliance-Check durchführen', icon: 'scale', pillar: 'validation' },
    ],
    conflict: [
        { toolId: 'dor', label: 'Ready-Check durchführen', icon: 'list-checks', pillar: 'validation' },
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
    ],
    devil: [
        { toolId: 'compliance', label: 'Compliance-Check durchführen', icon: 'scale', pillar: 'validation' },
        { toolId: 'dor', label: 'Ready-Check durchführen', icon: 'list-checks', pillar: 'validation' },
    ],
    compliance: [
        { toolId: 'dor', label: 'Ready-Check durchführen', icon: 'list-checks', pillar: 'validation' },
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
    ],
    dor: [
        { toolId: 'bva', label: 'BVA & EP ableiten', icon: 'sliders', pillar: 'validation' },
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
    ],
    bva: [
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
        { toolId: 'dor', label: 'Definition of Ready prüfen', icon: 'list-checks', pillar: 'validation' },
    ],
    export_context: [
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
        { toolId: 'traceability', label: 'Traceability Matrix generieren', icon: 'link', pillar: 'management' },
    ],
    jira_dashboard: [
        { toolId: 'backlog', label: 'Backlog & Prio öffnen', icon: 'list-todo', pillar: 'management' },
        { toolId: 'impact', label: 'Change Impact Analyse', icon: 'git-pull-request', pillar: 'management' },
    ],
    backlog: [
        { toolId: 'export_context', label: 'Export für Claude Code erstellen', icon: 'download', pillar: 'management' },
        { toolId: 'traceability', label: 'Traceability Matrix generieren', icon: 'link', pillar: 'management' },
        { toolId: 'impact', label: 'Change Impact Analyse', icon: 'git-pull-request', pillar: 'management' },
    ],
    traceability: [
        { toolId: 'impact', label: 'Change Impact Analyse', icon: 'git-pull-request', pillar: 'management' },
        { toolId: 'poker', label: 'KI-Planning-Poker starten', icon: 'users', pillar: 'management' },
    ],
    impact: [
        { toolId: 'poker', label: 'KI-Planning-Poker starten', icon: 'users', pillar: 'management' },
        { toolId: 'translate', label: 'Mgmt.-Übersetzer öffnen', icon: 'megaphone', pillar: 'management' },
    ],
    poker: [
        { toolId: 'export_context', label: 'Export für Claude Code erstellen', icon: 'download', pillar: 'management' },
        { toolId: 'translate', label: 'Mgmt.-Übersetzer öffnen', icon: 'megaphone', pillar: 'management' },
    ],
    translate: [
        { toolId: 'export_context', label: 'Export für Claude Code erstellen', icon: 'download', pillar: 'management' },
    ],
}

export function getRecommendations(toolId: string, subKey?: string): ToolRecommendation[] {
    if (subKey) {
        const variantKey = `${toolId}:${subKey}`
        if (RECOMMENDATIONS[variantKey]) return RECOMMENDATIONS[variantKey]
    }
    return RECOMMENDATIONS[toolId] ?? []
}