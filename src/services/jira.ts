/**
 * Jira Cloud REST API Client – Typisierter Service für die 3 Use Cases:
 * UC1: Jira-Übergabe (Anforderungen → Issues)
 * UC2: Jira-Ticket-Review (Issues laden & validieren)
 * UC3: RE-Health Dashboard (Traceability & Übersicht)
 *
 * WICHTIG (Browser): Die Jira-REST-API unterstützt kein CORS für Basic-Auth.
 * Daher läuft jeder Request über einen gleich-origin Proxy-Pfad (Default: /api/atlassian/jira),
 * der im Dev-Modus von Vite (server.proxy) auf die Jira-Instanz umgeschrieben wird.
 */

export class JiraError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'JiraError'
    }
}

/**
 * Basis-URL bzw. Proxy-Präfix für Jira-API-Aufrufe.
 * Default: /api/atlassian/jira (wird von Vite proxy auf https://domain/rest/api/3 umgeschrieben).
 */
export const JIRA_BASE_URL = (import.meta.env.VITE_JIRA_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/api/atlassian/jira'

/**
 * Jira-REST-API: Credential-Struktur für Basic-Auth.
 */
export interface JiraCredentials {
    email: string
    apiToken: string
}

/**
 * Jira-Sprint (Agile Board).
 */
export interface JiraSprint {
    id: number
    name: string
    state: 'active' | 'closed' | 'future'
    startDate?: string
    endDate?: string
    goal?: string
}

/**
 * Jira-Issue (Ticket).
 */
export interface JiraIssue {
    id: string
    key: string
    fields: {
        summary: string
        description?: string | Record<string, unknown> // ADF oder Plaintext
        status: { name: string }
        issuetype: { name: string }
        assignee?: { displayName: string } | null
        priority?: { name: string } | null
        created?: string
        updated?: string
        [key: string]: unknown
    }
}

/**
 * Jira-Issue für UC1 (create): Summary + Description + Labels + Priority.
 */
export interface JiraIssueCreatePayload {
    fields: {
        project: { key: string }
        summary: string
        description?: string
        issuetype: { name: string }
        labels?: string[]
        priority?: { name: string }
    }
}

/**
 * Parsed Issue für UC2 (Ticket-Review): Titel + Description als Plaintext.
 */
export interface ParsedJiraIssue {
    key: string
    title: string
    description: string
}

/**
 * Issue für UC3 (RE-Health Dashboard): Key, Title, Status, Priority, Updated.
 */
export interface DashboardIssue {
    key: string
    title: string
    status: string
    priority?: string
    updated?: string
}

/**
 * Basic-Auth-Header für Jira Cloud: base64("email:api_token").
 */
function authHeader(creds: JiraCredentials): string {
    // btoa erwartet Latin-1; E-Mail und Token sind ASCII, daher unkritisch.
    return `Basic ${btoa(`${creds.email}:${creds.apiToken}`)}`
}

/**
 * Hilfsfunktion: ADF (Atlassian Document Format) oder beliebiger Plaintext in Klartext konvertieren.
 * Falls description ein Object ist (ADF), versuche es zu vereinfachen; sonst als String durchreichen.
 */
function parseDescription(desc: unknown): string {
    if (!desc) return ''
    if (typeof desc === 'string') return desc.trim()
    if (typeof desc === 'object' && 'content' in (desc as Record<string, unknown>)) {
        // ADF-Struktur: versuche, content[] zu flachen
        const content = (desc as Record<string, unknown>).content as unknown[]
        if (Array.isArray(content)) {
            return content
                .map((block: unknown) => {
                    if (typeof block === 'object' && block !== null) {
                        const b = block as Record<string, unknown>
                        if ('content' in b && Array.isArray(b.content)) {
                            return (b.content as unknown[]).map((inline: unknown) => {
                                if (typeof inline === 'object' && inline !== null && 'text' in inline) {
                                    return (inline as Record<string, unknown>).text
                                }
                                return ''
                            }).join('')
                        }
                    }
                    return ''
                })
                .filter((s) => s.length > 0)
                .join('\n')
        }
    }
    return String(desc).trim()
}

/**
 * Generischer GET-Request gegen die Jira-API (über den Proxy-Pfad).
 */
async function jiraGet<T>(path: string, creds: JiraCredentials): Promise<T> {
    const url = path.startsWith('http')
        ? path
        : `${JIRA_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

    let response: Response
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: authHeader(creds),
                Accept: 'application/json',
            },
        })
    } catch (error) {
        // Netzwerk-/CORS-Fehler landen hier (z. B. wenn kein Proxy konfiguriert ist).
        throw new JiraError(
            `Jira nicht erreichbar: ${(error as Error).message}. ` +
                'Ist der Proxy (VITE_ATLASSIAN_DOMAIN in vite.config.ts) konfiguriert?',
        )
    }

    if (!response.ok) {
        const text = await response
            .text()
            .catch(() => response.statusText)
        if (response.status === 401 || response.status === 403) {
            throw new JiraError(
                `Jira-Authentifizierung fehlgeschlagen (${response.status}). Token/E-Mail prüfen. ${text || ''}`.trim(),
            )
        }
        throw new JiraError(`Jira ${response.status}: ${text || response.statusText}`)
    }

    return response.json() as Promise<T>
}

/**
 * Generischer POST-Request gegen die Jira-API (über den Proxy-Pfad).
 */
async function jiraPost<T>(path: string, payload: unknown, creds: JiraCredentials): Promise<T> {
    const url = path.startsWith('http')
        ? path
        : `${JIRA_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

    let response: Response
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: authHeader(creds),
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        })
    } catch (error) {
        throw new JiraError(
            `Jira nicht erreichbar: ${(error as Error).message}. ` +
                'Ist der Proxy (VITE_ATLASSIAN_DOMAIN in vite.config.ts) konfiguriert?',
        )
    }

    if (!response.ok) {
        const text = await response
            .text()
            .catch(() => response.statusText)
        if (response.status === 401 || response.status === 403) {
            throw new JiraError(
                `Jira-Authentifizierung fehlgeschlagen (${response.status}). Token/E-Mail prüfen. ${text || ''}`.trim(),
            )
        }
        throw new JiraError(`Jira ${response.status}: ${text || response.statusText}`)
    }

    return response.json() as Promise<T>
}

/**
 * Verbindungstest: liefert Anzeigename des angemeldeten Kontos.
 * Wird von Settings-Modal verwendet, um Credentials zu validieren.
 */
export async function verifyJiraCredentials(creds: JiraCredentials): Promise<string> {
    const me = await jiraGet<{ displayName: string; emailAddress?: string }>('/myself', creds)
    return me.displayName
}

/**
 * Aktiven Sprint eines Boards ermitteln (oder null, falls keiner aktiv ist).
 * Benötigt die Board-ID (vom Nutzer in der UI eingeben).
 */
export async function getActiveSprint(boardId: number, creds: JiraCredentials): Promise<JiraSprint | null> {
    const data = await jiraGet<{ values: JiraSprint[] }>(
        `/agile/1.0/board/${boardId}/sprint?state=active`,
        creds,
    )
    return data.values[0] ?? null
}

/**
 * Alle Issues eines Sprints laden (mit Pagination).
 * Ruft die Agile-API auf (üblicherweise unter /api/atlassian/jira-agile gemappt).
 */
export async function getSprintIssues(
    sprintId: number,
    creds: JiraCredentials,
    maxResults = 50,
): Promise<JiraIssue[]> {
    const fields = 'summary,description,status,assignee,issuetype,priority,updated'
    const issues: JiraIssue[] = []
    let startAt = 0

    for (;;) {
        const data = await jiraGet<{ issues: JiraIssue[]; total: number }>(
            `/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`,
            creds,
        )

        issues.push(...data.issues)
        startAt += maxResults
        if (startAt >= data.total || data.issues.length === 0) break
    }

    return issues
}

/**
 * Komfort: aktiven Sprint eines Boards inkl. aller Issues laden.
 * Wrapper um getActiveSprint + getSprintIssues.
 */
export async function getCurrentSprintIssues(
    boardId: number,
    creds: JiraCredentials,
): Promise<{ sprint: JiraSprint; issues: JiraIssue[] }> {
    const sprint = await getActiveSprint(boardId, creds)
    if (!sprint) throw new JiraError(`Kein aktiver Sprint auf Board ${boardId} gefunden.`)

    const issues = await getSprintIssues(sprint.id, creds)
    return { sprint, issues }
}

/**
 * UC2: Einzelnes Issue laden und parsen (ADF → Plaintext).
 * Fields: summary, description, status, assignee, priority, updated.
 */
export async function loadAndParseIssue(issueKey: string, creds: JiraCredentials): Promise<ParsedJiraIssue> {
    const issue = await jiraGet<JiraIssue>(
        `/issue/${issueKey}?fields=summary,description,status,assignee,priority,updated`,
        creds,
    )

    const description = parseDescription(issue.fields.description)

    return {
        key: issue.key,
        title: issue.fields.summary,
        description,
    }
}

/**
 * UC3: Alle Issues eines Jira-Projekts laden (für RE-Health Dashboard).
 * Nutzt JQL: `project = KEY ORDER BY updated DESC`.
 *
 * WICHTIG: Der alte GET-Endpoint `/search` wurde von Atlassian entfernt (HTTP 410).
 * Diese Funktion nutzt den neuen `GET /search/jql`-Endpoint mit token-basierter
 * Pagination (`nextPageToken`) – die neue API liefert kein `total`/`startAt` mehr.
 * (GET statt POST, da der POST-Endpoint über den Proxy 403 liefert – analog UC2.)
 * Siehe: https://developer.atlassian.com/changelog/#CHANGE-2046
 */
export async function loadProjectIssuesForDashboard(
    projectKey: string,
    creds: JiraCredentials,
    maxResults = 100,
): Promise<DashboardIssue[]> {
    const jql = `project = ${projectKey} ORDER BY updated DESC`
    const issues: DashboardIssue[] = []
    let nextPageToken: string | undefined
    // Sicherheitslimit gegen Endlosschleifen (max. ~10.000 Issues).
    const maxPages = 100

    for (let page = 0; page < maxPages; page++) {
        const query = new URLSearchParams({
            jql,
            maxResults: String(maxResults),
            fields: 'summary,status,priority,updated',
        })
        if (nextPageToken) query.set('nextPageToken', nextPageToken)

        const data = await jiraGet<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>(
            `/search/jql?${query.toString()}`,
            creds,
        )

        for (const issue of data.issues ?? []) {
            issues.push({
                key: issue.key,
                title: issue.fields.summary,
                status: issue.fields.status.name,
                priority: issue.fields.priority?.name,
                updated: issue.fields.updated,
            })
        }

        nextPageToken = data.nextPageToken
        if (!nextPageToken || data.isLast || (data.issues?.length ?? 0) === 0) break
    }

    return issues
}

/**
 * UC1: Issue erstellen (z. B. aus Anforderung).
 * Summary: `[REQ-ID] Anforderungstext` (max 255 Zeichen).
 * Description: vollständiger Anforderungstext.
 * Labels: z. B. 'ireb-re-assistant', optional 'must', 'should', etc.
 * Priority: gemappt aus MoSCoW (Must → Highest, Should → High, Could → Medium, Won't → Low).
 *
 * Rückgabe: { key: 'REQ-42', id: '...', ... }
 */
/**
 * Wandelt Plaintext in ein minimales Atlassian Document Format (ADF) um.
 * Jira Cloud REST API v3 verlangt für das `description`-Feld ein ADF-Dokument.
 * Jede nicht-leere Zeile wird zu einem eigenen Paragraph; Leerzeilen werden
 * zu leeren Paragraphen (Absatzabstand).
 */
function textToAdf(text: string): Record<string, unknown> {
    const lines = (text || '').split(/\r?\n/)
    const content = lines.map((line) =>
        line.length > 0
            ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
            : { type: 'paragraph' },
    )
    if (content.length === 0) {
        content.push({ type: 'paragraph' })
    }
    return { type: 'doc', version: 1, content }
}

export async function createIssueFromRequirement(
    projectKey: string,
    summary: string,
    description: string,
    labels: string[] = [],
    priority: string = 'Medium',
    creds: JiraCredentials,
    issueType: string = 'Story',
): Promise<{ key: string; id: string }> {
    const payload: JiraIssueCreatePayload = {
        fields: {
            project: { key: projectKey },
            summary: summary.substring(0, 255), // Jira-Limit
            description: textToAdf(description.substring(0, 32767)), // Jira-Cloud v3 erwartet ADF
            issuetype: { name: issueType },
            labels: ['ireb-re-assistant', ...labels],
            priority: { name: priority },
        },
    }

    const result = await jiraPost<{ key: string; id: string }>('/issue', payload, creds)
    return result
}

/**
 * Hilfsfunktion: IREB-Anforderungstyp auf einen Jira-Issue-Type mappen.
 */
export function mapTypeToIssueType(type?: string): string {
    const t = (type ?? '').toLowerCase()
    if (t.includes('bug') || t.includes('fehler')) return 'Bug'
    if (t.includes('epic')) return 'Epic'
    if (
        t.includes('constraint') ||
        t.includes('randbedingung') ||
        t.includes('nicht-funktional') ||
        t.includes('qualität') ||
        t.includes('nfr')
    ) {
        return 'Task'
    }
    return 'Story'
}

/**
 * Hilfsfunktion: MoSCoW zu Jira-Priorität mappen.
 */
export function mapMoscowToPriority(moscow?: string): string {
    switch ((moscow ?? '').toLowerCase()) {
        case 'must':
            return 'Highest'
        case 'should':
            return 'High'
        case 'could':
            return 'Medium'
        case "won't":
        case 'wont':
            return 'Low'
        default:
            return 'Medium'
    }
}

/**
 * Komfortfunktion für Dashboard-Ausgabe: Datet aus Dashboard-Issues extrahieren.
 * Wird für UC3 verwendet.
 */
export function formatDashboardIssue(issue: DashboardIssue): string {
    const dateStr = issue.updated ? new Date(issue.updated).toLocaleDateString('de-DE') : '?'
    return `| ${issue.key} | ${issue.title} | ${issue.status} | ${issue.priority ?? '—'} | ${dateStr} |`
}

/**
 * ============================================================================
 * ADAPTER-FUNKTIONEN: Automatische Settings-Integration
 * ============================================================================
 *
 * Die folgenden Funktionen sind Wrapper, die den Settings-Store automatisch
 * auflösen und die Credentials implizit weitergeben. Dies ermöglicht eine
 * einfachere Integration in ToolView.vue und ApiModal.vue ohne Export/Import
 * des Settings-Store dort.
 *
 * HINWEIS: Diese Funktionen sind nur für Vue-Komponenten gedacht, da sie den
 * Store implizit laden. Services sollten weiterhin die Kern-Funktionen mit
 * expliziten Credentials verwenden.
 */

/**
 * Adapter: Verbindungstest mit automatischen Settings-Credentials.
 * Wird von ApiModal.vue für die Jira-Konfigurationsprüfung verwendet.
 */
export async function testJiraConnectionAdapter(): Promise<string> {
    // Dynamischer Import, um Zirkelbezüge zu vermeiden
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()

    if (!settings.atlassianEmail || !settings.atlassianToken) {
        throw new JiraError(
            'Jira-Zugangsdaten unvollständig. Bitte E-Mail und API-Token hinterlegen.',
        )
    }

    return verifyJiraCredentials({
        email: settings.atlassianEmail,
        apiToken: settings.atlassianToken,
    })
}

/**
 * Adapter: Aktiven Sprint + Issues laden mit automatischen Settings-Credentials.
 * Wird von ToolView.vue für UC1 (Backlog) verwendet.
 */
export async function getCurrentSprintIssuesAdapter(boardId: number): Promise<{ sprint: JiraSprint; issues: JiraIssue[] }> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()

    if (!settings.atlassianEmail || !settings.atlassianToken) {
        throw new JiraError('Jira-Zugangsdaten unvollständig.')
    }

    return getCurrentSprintIssues(boardId, {
        email: settings.atlassianEmail,
        apiToken: settings.atlassianToken,
    })
}

/**
 * Adapter: Dashboard-Issues laden mit automatischen Settings-Credentials.
 * Wird von ToolView.vue für UC3 (RE-Health Dashboard) verwendet.
 */
export async function loadProjectIssuesForDashboardAdapter(projectKey: string): Promise<DashboardIssue[]> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()

    if (!settings.atlassianEmail || !settings.atlassianToken) {
        throw new JiraError('Jira-Zugangsdaten unvollständig.')
    }

    return loadProjectIssuesForDashboard(projectKey, {
        email: settings.atlassianEmail,
        apiToken: settings.atlassianToken,
    })
}

/**
 * Adapter: Einzelnes Issue laden & parsen mit automatischen Settings-Credentials.
 * Wird von ToolView.vue für UC2 (Ticket-Review) verwendet.
 */
export async function loadAndParseIssueAdapter(issueKey: string): Promise<ParsedJiraIssue> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()

    if (!settings.atlassianEmail || !settings.atlassianToken) {
        throw new JiraError('Jira-Zugangsdaten unvollständig.')
    }

    return loadAndParseIssue(issueKey, {
        email: settings.atlassianEmail,
        apiToken: settings.atlassianToken,
    })
}

/**
 * Adapter: Issue erstellen mit automatischen Settings-Credentials.
 * Wird von ToolView.vue für UC1 (Jira-Übergabe) verwendet.
 */
export async function createIssueFromRequirementAdapter(
    summary: string,
    description: string,
    labels?: string[],
    priority?: string,
    issueType?: string,
): Promise<{ key: string; id: string }> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()

    if (!settings.atlassianEmail || !settings.atlassianToken || !settings.atlassianJiraProject) {
        throw new JiraError('Jira-Konfiguration unvollständig (Credentials oder Projekt-Key).')
    }

    return createIssueFromRequirement(
        settings.atlassianJiraProject,
        summary,
        description,
        labels,
        priority || 'Medium',
        {
            email: settings.atlassianEmail,
            apiToken: settings.atlassianToken,
        },
        issueType || 'Story',
    )
}
