/**
 * Atlassian REST API Client – Jira Cloud + Confluence Cloud
 *
 * Authentifizierung: HTTP Basic Auth (email:apiToken, base64-kodiert).
 * Im lokalen Betrieb (npm run dev) werden alle Anfragen über den Vite-Dev-Proxy
 * geleitet:
 *   /api/atlassian/jira/*  →  https://<DOMAIN>/rest/api/3/*
 *   /api/atlassian/wiki/*  →  https://<DOMAIN>/wiki/rest/api/*
 *
 * VITE_ATLASSIAN_DOMAIN muss dazu in .env.local gesetzt sein (siehe .env.example).
 * In einem Produktionsbetrieb muss ein gleichwertiger Reverse-Proxy eingerichtet
 * werden, da Atlassian Cloud keine CORS-Anfragen von beliebigen Browsern erlaubt.
 */

import type { GlossaryEntry, Requirement } from '@/types'

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

export interface AtlassianConfig {
    domain: string              // z. B. "meinefirma.atlassian.net"
    email: string               // Atlassian-Account-E-Mail
    token: string               // Atlassian API Token (https://id.atlassian.com/manage-profile/security/api-tokens)
    jiraProjectKey: string      // Jira-Projektschlüssel, z. B. "REQ"
    confluenceSpaceKey: string  // Confluence-Space-Schlüssel, z. B. "RE"
}

export interface JiraIssueMeta {
    id: string
    key: string
    self: string
    url: string
}

export interface JiraProjectIssue {
    id: string
    key: string
    summary: string
    status: string
    priority: string
    assignee: string
    issueType: string
    created: string
    updated: string
    url: string
}

export interface ConfluencePageMeta {
    id: string
    url: string
}

export interface AtlassianConnectionDiagnostics {
    authOk: boolean
    projectVisible: boolean
    boardAccessible: boolean
    message: string
}

export class AtlassianError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'AtlassianError'
    }
}

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

const JIRA_BASE = '/api/atlassian/jira'
const JIRA_AGILE_BASE = '/api/atlassian/jira-agile'
const WIKI_BASE = '/api/atlassian/wiki'

function mapJiraIssueFromFields(
    domain: string,
    issue: {
        id: string
        key: string
        fields: {
            summary?: string
            status?: { name?: string }
            priority?: { name?: string }
            assignee?: { displayName?: string } | null
            issuetype?: { name?: string }
            created?: string
            updated?: string
        }
    },
): JiraProjectIssue {
    return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary ?? '(ohne Summary)',
        status: issue.fields.status?.name ?? 'Unknown',
        priority: issue.fields.priority?.name ?? 'Unknown',
        assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
        issueType: issue.fields.issuetype?.name ?? 'Unknown',
        created: issue.fields.created ?? '',
        updated: issue.fields.updated ?? '',
        url: `https://${domain}/browse/${issue.key}`,
    }
}

function buildAuth(email: string, token: string): string {
    return `Basic ${btoa(`${email}:${token}`)}`
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

async function apiRequest<T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT',
    auth: string,
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = {
        Authorization: auth,
        Accept: 'application/json',
    }
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
    }

    let response: Response
    try {
        response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        })
    } catch (error) {
        throw new AtlassianError(
            `Atlassian nicht erreichbar: ${(error as Error).message}. ` +
                'Pruefen Sie Domain/Netzwerk und den Proxy.',
        )
    }

    if (!response.ok) {
        if (response.status === 404 && url.startsWith('/api/atlassian/')) {
            throw new AtlassianError(
                'Atlassian 404: Der lokale Proxy ist nicht aktiv. ' +
                    'Setzen Sie VITE_ATLASSIAN_DOMAIN in .env.local (z. B. rewe.atlassian.net) ' +
                    'und starten Sie den Dev-Server neu.',
            )
        }
        const text = await response.text().catch(() => response.statusText)
        let detail = text
        try {
            const parsed = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string> }
            const msgs = [
                ...(parsed.errorMessages ?? []),
                ...Object.values(parsed.errors ?? {}),
            ]
            if (msgs.length) detail = msgs.join(' | ')
        } catch {
            // Raw text is fine.
        }
        throw new AtlassianError(`Atlassian ${response.status}: ${detail}`)
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Atlassian Document Format (ADF) – für Jira REST API v3
// ---------------------------------------------------------------------------

function textToAdf(text: string): object {
    const paragraphs = text.split(/\n{2,}/).filter(Boolean)
    return {
        type: 'doc',
        version: 1,
        content: paragraphs.map((para) => ({
            type: 'paragraph',
            content: para
                .split('\n')
                .flatMap((line, i, arr) => {
                    const nodes: object[] = [{ type: 'text', text: line }]
                    if (i < arr.length - 1) nodes.push({ type: 'hardBreak' })
                    return nodes
                }),
        })),
    }
}

function mapMoscowToPriority(priority?: string): string {
    switch ((priority ?? '').toLowerCase()) {
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

// ---------------------------------------------------------------------------
// Jira API
// ---------------------------------------------------------------------------

/**
 * Erstellt ein neues Jira-Issue (Story) für eine IREB-Anforderung.
 * Setzt IREB-Labels und mappt MoSCoW-Priorität auf Jira-Prioritäten.
 */
export async function createJiraIssue(
    config: AtlassianConfig,
    req: Requirement,
): Promise<JiraIssueMeta> {
    const auth = buildAuth(config.email, config.token)
    const summary = `[${req.id}] ${req.text.slice(0, 250)}`

    const labels: string[] = ['ireb-re-assistant']
    if (req.type) labels.push(`ireb-${req.type.toLowerCase().replace(/\s/g, '-')}`)
    if (req.complexity) labels.push(`complexity-${req.complexity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)

    const issueBody = {
        fields: {
            project: { key: config.jiraProjectKey },
            summary,
            description: textToAdf(req.text),
            issuetype: { name: 'Story' },
            labels,
            priority: { name: mapMoscowToPriority(req.priority) },
        },
    }

    const result = await apiRequest<{ id: string; key: string; self: string }>(
        `${JIRA_BASE}/issue`,
        'POST',
        auth,
        issueBody,
    )

    return {
        id: result.id,
        key: result.key,
        self: result.self,
        url: `https://${config.domain}/browse/${result.key}`,
    }
}

/**
 * Gibt verfügbare Jira-Projekte zurück – nützlich für die Konfigurationsprüfung.
 */
export async function getJiraProjects(
    config: AtlassianConfig,
): Promise<{ key: string; name: string }[]> {
    const auth = buildAuth(config.email, config.token)
    const result = await apiRequest<{ values: { key: string; name: string }[] }>(
        `${JIRA_BASE}/project/search?maxResults=50&orderBy=name`,
        'GET',
        auth,
    )
    return result.values
}

/**
 * Prüft ein Jira-Projekt direkt über den Project-Key.
 * Liefert null, wenn das Projekt für den Token nicht sichtbar ist.
 */
export async function getJiraProjectByKey(
    config: AtlassianConfig,
    projectKey: string,
): Promise<{ key: string; name: string } | null> {
    const auth = buildAuth(config.email, config.token)
    try {
        const result = await apiRequest<{ key: string; name: string }>(
            `${JIRA_BASE}/project/${encodeURIComponent(projectKey)}`,
            'GET',
            auth,
        )
        return result
    } catch (error) {
        if (error instanceof AtlassianError && /404/.test(error.message)) {
            return null
        }
        throw error
    }
}

// ---------------------------------------------------------------------------
// Jira Issue Detail (für Qualitätsprüfung)
// ---------------------------------------------------------------------------

export interface JiraIssueDetail {
    key: string
    summary: string
    description: string
    status: string
    issueType: string
    url: string
}

function adfToPlainText(node: unknown): string {
    if (!node || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (n.type === 'text') return n.text ?? ''
    if (Array.isArray(n.content)) {
        const joined = n.content.map(adfToPlainText).join('')
        if (n.type === 'paragraph') return joined + '\n'
        return joined
    }
    return ''
}

/**
 * Lädt ein einzelnes Jira-Issue mit Beschreibung (für die KI-Qualitätsprüfung).
 */
export async function getJiraIssueDetail(
    config: AtlassianConfig,
    issueKey: string,
): Promise<JiraIssueDetail> {
    const auth = buildAuth(config.email, config.token)
    const result = await apiRequest<{
        key: string
        fields: {
            summary?: string
            description?: unknown
            status?: { name?: string }
            issuetype?: { name?: string }
        }
    }>(
        `${JIRA_BASE}/issue/${encodeURIComponent(issueKey)}?fields=summary,description,status,issuetype`,
        'GET',
        auth,
    )
    const descText = adfToPlainText(result.fields.description).trim()
    return {
        key: result.key,
        summary: result.fields.summary ?? '',
        description: descText,
        status: result.fields.status?.name ?? 'Unknown',
        issueType: result.fields.issuetype?.name ?? 'Unknown',
        url: `https://${config.domain}/browse/${result.key}`,
    }
}

/**
 * Liest Issues eines Jira-Projekts für Reporting-/Dashboard-Zwecke aus.
 */
export async function getJiraProjectIssues(
    config: AtlassianConfig,
    maxTotal = 500, // maximale Gesamtanzahl über alle Seiten
): Promise<JiraProjectIssue[]> {
    const auth = buildAuth(config.email, config.token)
    const pageSize = 100
    const allIssues: JiraProjectIssue[] = []
    let nextPageToken: string | undefined
    // Sicherheitslimit: ceil(maxTotal / pageSize) Seiten
    const maxPages = Math.ceil(Math.max(maxTotal, pageSize) / pageSize)

    for (let page = 0; page < maxPages; page++) {
        const query = new URLSearchParams({
            jql: `project = ${config.jiraProjectKey} ORDER BY updated DESC`,
            maxResults: String(pageSize),
            fields: 'summary,status,priority,assignee,issuetype,created,updated',
        })
        if (nextPageToken) query.set('nextPageToken', nextPageToken)

        const result = await apiRequest<{
            issues: Array<{
                id: string
                key: string
                fields: {
                    summary?: string
                    status?: { name?: string }
                    priority?: { name?: string }
                    assignee?: { displayName?: string } | null
                    issuetype?: { name?: string }
                    created?: string
                    updated?: string
                }
            }>
            nextPageToken?: string
            isLast?: boolean
        }>(
            `${JIRA_BASE}/search/jql?${query.toString()}`,
            'GET',
            auth,
        )

        for (const issue of result.issues ?? []) {
            allIssues.push(mapJiraIssueFromFields(config.domain, issue))
        }

        nextPageToken = result.nextPageToken
        if (!nextPageToken || result.isLast || (result.issues?.length ?? 0) === 0) break
    }

    if (allIssues.length > 0) {
        return allIssues
    }

    // Fallback: Einige Jira-Setups liefern für das Projekt-JQL keine Ergebnisse,
    // obwohl Boards und Issues sichtbar sind. Deshalb lesen wir Board-Issues direkt.
    const boards = await apiRequest<{
        values: Array<{ id: number; name: string }>
    }>(
        `${JIRA_AGILE_BASE}/board?projectKeyOrId=${encodeURIComponent(config.jiraProjectKey)}&maxResults=10`,
        'GET',
        auth,
    )

    if (!boards.values?.length) {
        return []
    }

    const unique = new Map<string, JiraProjectIssue>()
    const boardsToScan = boards.values.slice(0, 3)
    for (const board of boardsToScan) {
        const boardIssues = await apiRequest<{
            issues: Array<{
                id: string
                key: string
                fields: {
                    summary?: string
                    status?: { name?: string }
                    priority?: { name?: string }
                    assignee?: { displayName?: string } | null
                    issuetype?: { name?: string }
                    created?: string
                    updated?: string
                }
            }>
        }>(
            `${JIRA_AGILE_BASE}/board/${board.id}/issue?maxResults=${Math.max(20, Math.min(maxResults, 100))}&fields=summary,status,priority,assignee,issuetype,created,updated`,
            'GET',
            auth,
        )

        for (const issue of boardIssues.issues ?? []) {
            unique.set(issue.key, mapJiraIssueFromFields(config.domain, issue))
        }
    }

    return Array.from(unique.values())
}

// ---------------------------------------------------------------------------
// Confluence API (REST API v1 – Storage Format)
// ---------------------------------------------------------------------------

function buildConfluenceStorage(
    vision: string,
    stakeholders: string,
    personas: string,
    requirements: Requirement[],
    glossary: GlossaryEntry[],
    exportedAt: string,
): string {
    const infoBox = `<p><em>Zuletzt synchronisiert: ${exportedAt} via IREB RE Assistant</em></p>`

    let html = infoBox

    if (vision) {
        html += `<h2>Projektvision</h2><p>${escapeHtml(vision)}</p>`
    }

    if (stakeholders) {
        html += `<h2>Stakeholder</h2><p>${escapeHtml(stakeholders)}</p>`
    }

    if (personas) {
        html += `<h2>Personas</h2><p>${escapeHtml(personas)}</p>`
    }

    if (requirements.length > 0) {
        html += '<h2>Anforderungen (Backlog)</h2>'
        html += '<table><tbody>'
        html += '<tr><th><strong>ID</strong></th><th><strong>Anforderung</strong></th><th><strong>Typ</strong></th><th><strong>Priorität</strong></th><th><strong>Komplexität</strong></th><th><strong>Jira</strong></th></tr>'
        for (const r of requirements) {
            const jiraLink = r.jiraKey
                ? `<a href="/browse/${escapeHtml(r.jiraKey)}">${escapeHtml(r.jiraKey)}</a>`
                : '-'
            html += `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.text)}</td><td>${escapeHtml(r.type ?? '-')}</td><td>${escapeHtml(r.priority ?? '-')}</td><td>${escapeHtml(r.complexity ?? '-')}</td><td>${jiraLink}</td></tr>`
        }
        html += '</tbody></table>'
    }

    if (glossary.length > 0) {
        html += '<h2>Glossar (Single Source of Truth)</h2>'
        html += '<table><tbody>'
        html += '<tr><th><strong>Begriff</strong></th><th><strong>Definition</strong></th></tr>'
        for (const g of glossary) {
            html += `<tr><td><strong>${escapeHtml(g.term)}</strong></td><td>${escapeHtml(g.definition)}</td></tr>`
        }
        html += '</tbody></table>'
    }

    return html
}

/**
 * Erstellt eine neue Confluence-Seite oder aktualisiert eine bestehende (Upsert).
 * Gibt ID + URL der Seite zurück.
 */
export async function upsertConfluencePage(
    config: AtlassianConfig,
    title: string,
    storageBody: string,
    existingPageId?: string,
): Promise<ConfluencePageMeta> {
    const auth = buildAuth(config.email, config.token)

    if (existingPageId) {
        // Aktuelle Version abfragen, um die Versionsnummer zu inkrementieren.
        const existing = await apiRequest<{ version: { number: number } }>(
            `${WIKI_BASE}/content/${existingPageId}?expand=version`,
            'GET',
            auth,
        )

        await apiRequest<void>(
            `${WIKI_BASE}/content/${existingPageId}`,
            'PUT',
            auth,
            {
                version: { number: existing.version.number + 1 },
                title,
                type: 'page',
                body: {
                    storage: { value: storageBody, representation: 'storage' },
                },
            },
        )

        return {
            id: existingPageId,
            url: `https://${config.domain}/wiki/pages/${existingPageId}`,
        }
    }

    const created = await apiRequest<{ id: string; _links: { webui: string } }>(
        `${WIKI_BASE}/content`,
        'POST',
        auth,
        {
            type: 'page',
            title,
            space: { key: config.confluenceSpaceKey },
            body: {
                storage: { value: storageBody, representation: 'storage' },
            },
        },
    )

    return {
        id: created.id,
        url: `https://${config.domain}/wiki${created._links.webui}`,
    }
}

/**
 * Synchronisiert das gesamte IREB-Projektdokument nach Confluence.
 * Beim ersten Aufruf wird eine neue Seite erstellt; bei Folgeaufrufen wird
 * die bestehende Seite aktualisiert (anhand der gespeicherten Page-ID).
 */
export async function syncProjectToConfluence(
    config: AtlassianConfig,
    data: {
        vision: string
        stakeholders: string
        personas: string
        requirements: Requirement[]
        glossary: GlossaryEntry[]
        existingPageId?: string
    },
): Promise<ConfluencePageMeta> {
    const exportedAt = new Date().toLocaleString('de-DE')
    const title = 'IREB RE-Assistant: Anforderungsdokumentation'
    const body = buildConfluenceStorage(
        data.vision,
        data.stakeholders,
        data.personas,
        data.requirements,
        data.glossary,
        exportedAt,
    )
    return upsertConfluencePage(config, title, body, data.existingPageId)
}

/**
 * Prüft die Konfiguration durch Abfrage der verfügbaren Projekte.
 * Wirft AtlassianError bei falschen Credentials oder Domain.
 */
export async function testAtlassianConnection(config: AtlassianConfig): Promise<AtlassianConnectionDiagnostics> {
    const auth = buildAuth(config.email, config.token)

    try {
        await apiRequest<{ accountId: string }>(`${JIRA_BASE}/myself`, 'GET', auth)
    } catch (error) {
        if (error instanceof AtlassianError && /401/.test(error.message)) {
            return {
                authOk: false,
                projectVisible: false,
                boardAccessible: false,
                message: 'Authentifizierung fehlgeschlagen (401). Bitte E-Mail und API-Token prüfen.',
            }
        }
        throw error
    }

    let projectVisible = false
    try {
        await apiRequest<{ key: string }>(
            `${JIRA_BASE}/project/${encodeURIComponent(config.jiraProjectKey)}`,
            'GET',
            auth,
        )
        projectVisible = true
    } catch (error) {
        if (!(error instanceof AtlassianError && /404|403/.test(error.message))) {
            throw error
        }
    }

    let boardAccessible = false
    try {
        const boards = await apiRequest<{ values?: Array<{ id: number }> }>(
            `${JIRA_AGILE_BASE}/board?projectKeyOrId=${encodeURIComponent(config.jiraProjectKey)}&maxResults=1`,
            'GET',
            auth,
        )
        boardAccessible = (boards.values?.length ?? 0) > 0
    } catch (error) {
        if (!(error instanceof AtlassianError && /401|403|404/.test(error.message))) {
            throw error
        }
    }

    if (!projectVisible) {
        return {
            authOk: true,
            projectVisible: false,
            boardAccessible,
            message: `Authentifizierung ok, aber Projekt '${config.jiraProjectKey}' ist für den Token nicht sichtbar.`,
        }
    }

    if (!boardAccessible) {
        return {
            authOk: true,
            projectVisible: true,
            boardAccessible: false,
            message: `Projektzugriff ok, aber keine Boards für '${config.jiraProjectKey}' erreichbar (Board-Rechte prüfen).`,
        }
    }

    return {
        authOk: true,
        projectVisible: true,
        boardAccessible: true,
        message: 'Verbindung erfolgreich: Auth, Projekt und Boardzugriff sind ok.',
    }
}
