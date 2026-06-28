export type AdvisorPhase = 'elicitation' | 'documentation' | 'validation' | 'management'

export interface AdvisorStep {
    key: string
    phase: AdvisorPhase
    label: string
    question: string
    demoAnswer: string
}

export interface AdvisorAnswers {
    vision: string
    userRole: string
    pain: string
    solution: string
    benefit: string
    constraints: string
    acceptanceCriteria: string[]
}

export interface AdvisorArtifactSnapshot {
    tempVision: string
    tempPersonaText: string
    tempTranscript: string
    tempNote: string
    tempValReqText: string
    requirements: Array<{ id: string; text: string }>
    globalContext: {
        vision: string
        personas: string
        stakeholders: string
        systemkontext: string
    }
}

const PHASE_LABELS: Record<AdvisorPhase, string> = {
    elicitation: 'Ermittlung',
    documentation: 'Dokumentation',
    validation: 'Validierung',
    management: 'Management',
}

export const ADVISOR_STEPS: AdvisorStep[] = [
    {
        key: 'vision',
        phase: 'elicitation',
        label: 'Projektziel',
        question: 'Was ist das Ziel oder Problem Ihres Projekts in einem Satz?',
        demoAnswer: 'Im Supermarkt soll die MHD-Kontrolle schneller und fehlerfreier werden.',
    },
    {
        key: 'userRole',
        phase: 'elicitation',
        label: 'Zielnutzer',
        question: 'Wer ist der wichtigste Nutzer dieser Lösung?',
        demoAnswer: 'Marktmitarbeitende in der Frischeabteilung mit mobilen Handscannern.',
    },
    {
        key: 'pain',
        phase: 'elicitation',
        label: 'Schmerzpunkt',
        question: 'Was ist heute der größte Schmerzpunkt im Ablauf?',
        demoAnswer: 'Mitarbeitende laufen manuell durch Regale und erfassen MHDs auf Papier.',
    },
    {
        key: 'solution',
        phase: 'documentation',
        label: 'Lösungsansatz',
        question: 'Welche konkrete Funktion soll die Software liefern?',
        demoAnswer: 'Die Scanner-App zeigt kritische MHD-Artikel und ermöglicht direkte Reduktionsvorschläge.',
    },
    {
        key: 'benefit',
        phase: 'documentation',
        label: 'Nutzen',
        question: 'Welchen messbaren Nutzen soll das bringen?',
        demoAnswer: 'Weniger Abschriften und mindestens 30 Minuten Zeitersparnis pro Schicht.',
    },
    {
        key: 'constraints',
        phase: 'validation',
        label: 'Randbedingungen',
        question: 'Gibt es wichtige Randbedingungen (z. B. Offline, Compliance, Geräte)?',
        demoAnswer: 'Muss auf Zebra TC57 laufen, offline nutzbar sein und ans WWS angebunden werden.',
    },
    {
        key: 'acceptanceCriteria',
        phase: 'validation',
        label: 'Abnahmekriterien',
        question: 'Nennen Sie 3 prüfbare Akzeptanzkriterien (gern als Liste).',
        demoAnswer:
            '- Nach dem Scan wird bei MHD <= 3 Tage ein Reduktionshinweis angezeigt.\n- Ohne Netz werden Scans lokal zwischengespeichert.\n- Out-of-Stock-Meldungen werden nach Netzrückkehr automatisch synchronisiert.',
    },
]

const STEP_BY_KEY = Object.fromEntries(ADVISOR_STEPS.map((step) => [step.key, step])) as Record<string, AdvisorStep>
const PHASE_ORDER: AdvisorPhase[] = ['elicitation', 'documentation', 'validation', 'management']

function parseAcceptanceCriteria(text: string): string[] {
    return text
        .split(/\n|;|\|/)
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(Boolean)
}

function hasValue(value?: string): boolean {
    return Boolean(value && value.trim())
}

function normalizeKey(input: string): string {
    return input.trim()
}

export function detectStartPhaseFromArtifacts(snapshot: AdvisorArtifactSnapshot): AdvisorPhase {
    if (snapshot.requirements.length > 0 || hasValue(snapshot.tempValReqText)) return 'validation'
    if (hasValue(snapshot.tempNote) || hasValue(snapshot.tempTranscript)) return 'documentation'
    if (
        hasValue(snapshot.tempVision) ||
        hasValue(snapshot.globalContext.vision) ||
        hasValue(snapshot.globalContext.personas)
    ) {
        return 'elicitation'
    }
    return 'elicitation'
}

export function seedAnswersFromArtifacts(snapshot: AdvisorArtifactSnapshot): Record<string, string> {
    const seeded: Record<string, string> = {}
    const vision = snapshot.globalContext.vision || snapshot.tempVision
    const role = snapshot.globalContext.personas || snapshot.tempPersonaText
    const pain = snapshot.tempTranscript
    const solution = snapshot.tempNote

    if (hasValue(vision)) seeded.vision = vision.trim()
    if (hasValue(role)) seeded.userRole = role.trim()
    if (hasValue(pain)) seeded.pain = pain.trim()
    if (hasValue(solution)) seeded.solution = solution.trim()
    if (hasValue(snapshot.tempValReqText)) seeded.benefit = snapshot.tempValReqText.trim()

    if (snapshot.requirements.length >= 3) {
        seeded.acceptanceCriteria = snapshot.requirements
            .slice(0, 3)
            .map((req) => req.text)
            .join('\n')
    }

    return seeded
}

export function countCompletedSteps(answers: Record<string, string>): number {
    return ADVISOR_STEPS.filter((step) => isStepAnswered(step.key, answers)).length
}

function isStepAnswered(stepKey: string, answers: Record<string, string>): boolean {
    const value = answers[stepKey]
    if (stepKey === 'acceptanceCriteria') return parseAcceptanceCriteria(value ?? '').length >= 3
    return hasValue(value)
}

export function getNextStep(answers: Record<string, string>, phase: AdvisorPhase): AdvisorStep | null {
    const startIndex = PHASE_ORDER.indexOf(phase)
    const orderedPhases = [...PHASE_ORDER.slice(startIndex), ...PHASE_ORDER.slice(0, startIndex)]

    for (const phaseKey of orderedPhases) {
        const nextInPhase = ADVISOR_STEPS.find(
            (step) => step.phase === phaseKey && !isStepAnswered(step.key, answers),
        )
        if (nextInPhase) return nextInPhase
    }

    return null
}

export function phaseLabel(phase: AdvisorPhase): string {
    return PHASE_LABELS[phase]
}

export function collectAdvisorAnswers(answers: Record<string, string>): AdvisorAnswers {
    const normalized = Object.fromEntries(
        Object.entries(answers).map(([key, value]) => [normalizeKey(key), value?.trim() ?? '']),
    )

    return {
        vision: normalized.vision ?? '',
        userRole: normalized.userRole ?? '',
        pain: normalized.pain ?? '',
        solution: normalized.solution ?? '',
        benefit: normalized.benefit ?? '',
        constraints: normalized.constraints ?? '',
        acceptanceCriteria: parseAcceptanceCriteria(normalized.acceptanceCriteria ?? ''),
    }
}

export function stepByKey(stepKey: string): AdvisorStep {
    return STEP_BY_KEY[stepKey]
}

export function formatUserStory(answers: AdvisorAnswers): string {
    const role = answers.userRole || 'relevanter Nutzer'
    const solution = answers.solution || answers.vision || 'eine Lösung'
    const benefit = answers.benefit || 'einen klaren Nutzen'
    return `Als ${role} möchte ich ${solution}, um ${benefit}.`
}

export function generateLocalAdvisorResult(answers: AdvisorAnswers): string {
    const userStory = formatUserStory(answers)
    const acceptanceCriteria = answers.acceptanceCriteria.length
        ? answers.acceptanceCriteria
        : ['Akzeptanzkriterium ergänzen']

    const dorChecks = [
        ['Wert & Zielbild klar', Boolean(answers.vision && answers.benefit)],
        ['Nutzerrolle benannt', Boolean(answers.userRole)],
        ['Schmerzpunkt beschrieben', Boolean(answers.pain)],
        ['Lösungsverhalten konkret', Boolean(answers.solution)],
        ['Randbedingungen dokumentiert', Boolean(answers.constraints)],
        ['Akzeptanzkriterien testbar', acceptanceCriteria.length >= 3],
    ]

    const dorChecklist = dorChecks
        .map(([label, ok]) => `- [${ok ? 'x' : ' '}] ${label}`)
        .join('\n')

    return [
        '## Ergebnis: DoR-nahe User Story',
        '',
        '**User Story**',
        userStory,
        '',
        '**Kontext (kurz)**',
        `- Ziel: ${answers.vision || 'n/a'}`,
        `- Schmerzpunkt: ${answers.pain || 'n/a'}`,
        `- Randbedingungen: ${answers.constraints || 'n/a'}`,
        '',
        '**Akzeptanzkriterien (Given/When/Then-orientiert)**',
        ...acceptanceCriteria.map((criterion, index) => `- ${index + 1}. ${criterion}`),
        '',
        '**Definition of Ready Check**',
        dorChecklist,
        '',
        acceptanceCriteria.length >= 3
            ? 'Status: Die Story ist gut vorbereitet und DoR-nah.'
            : 'Status: Für DoR bitte mindestens 3 präzise, prüfbare Akzeptanzkriterien ergänzen.',
    ].join('\n')
}

export function advisorAiSystemPrompt(): string {
    return [
        'Rolle: Senior Requirements Engineer (IREB CPRE).',
        'Ziel: Formuliere aus den gelieferten Antworten eine DoR-nahe User Story.',
        'Sprache: Deutsch.',
        'Format: 1) User Story (Als... möchte ich... um...), 2) Kurzkontext, 3) 3-6 testbare Akzeptanzkriterien, 4) DoR-Checkliste.',
        'Stil: präzise, klar, ohne Marketingfloskeln.',
    ].join('\n')
}

export function advisorAiUserPrompt(answers: AdvisorAnswers): string {
    return [
        `Projektziel: ${answers.vision}`,
        `Nutzerrolle: ${answers.userRole}`,
        `Schmerzpunkt: ${answers.pain}`,
        `Lösungsansatz: ${answers.solution}`,
        `Nutzen: ${answers.benefit}`,
        `Randbedingungen: ${answers.constraints}`,
        `Akzeptanzkriterien (Rohinput): ${answers.acceptanceCriteria.join(' | ')}`,
    ].join('\n')
}

export function advisorTurnSystemPrompt(): string {
    return [
        'Rolle: IREB CPRE Berater im Dialog.',
        'Aufgabe: Gib kurzes Feedback zur letzten Nutzerantwort und stelle genau EINE nächste, präzise Rückfrage.',
        'Arbeite phasenbezogen (Ermittlung, Dokumentation, Validierung, Management).',
        'Antwortformat in Markdown:',
        '1) Kurze Einordnung (max 2 Sätze)',
        '2) "Nächste Frage:" + konkrete Frage',
        'Kein Fließtext ohne Struktur.',
    ].join('\n')
}

export function advisorTurnUserPrompt(params: {
    currentPhase: AdvisorPhase
    currentStep: AdvisorStep
    answer: string
    knownAnswers: Record<string, string>
    suggestedNextQuestion: string
}): string {
    return [
        `Aktuelle CPRE-Phase: ${phaseLabel(params.currentPhase)}`,
        `Aktueller Fokus: ${params.currentStep.label}`,
        `Gestellte Frage: ${params.currentStep.question}`,
        `Nutzerantwort: ${params.answer}`,
        'Bekannte Antworten bisher:',
        ...Object.entries(params.knownAnswers).map(([k, v]) => `- ${k}: ${v}`),
        `Vorgeschlagene nächste Frage: ${params.suggestedNextQuestion}`,
        'Bitte formuliere ein kurzes Feedback und exakt eine nächste Frage.',
    ].join('\n')
}

export function buildLocalTurnReply(params: {
    currentPhase: AdvisorPhase
    currentStep: AdvisorStep
    nextStep: AdvisorStep | null
}): string {
    const intro = `Gute Eingabe für die CPRE-Phase **${phaseLabel(params.currentPhase)}** (${params.currentStep.label}).`
    if (!params.nextStep) {
        return [intro, '', 'Nächste Frage: Alle Kernpunkte sind erfasst. Ich erstelle jetzt die DoR-nahe User Story.'].join('\n')
    }

    return [
        intro,
        '',
        `Nächste Frage: ${params.nextStep.question}`,
    ].join('\n')
}
