import type { ImportedConfluenceContext } from '@/types'
import { useSettingsStore } from '@/stores/settings'

const DEFAULT_CONFLUENCE_PROXY_URL = 'http://localhost:8788'
const CONFLUENCE_PROXY_URL = (import.meta.env.VITE_CONFLUENCE_PROXY_URL as string | undefined) ?? DEFAULT_CONFLUENCE_PROXY_URL

export interface ConfluencePageContent {
  pageId: string
  title: string
  spaceKey?: string
  url: string
  html: string
  text: string
}

export class ConfluenceError extends Error {}

interface ConfluenceCredentialsPayload {
  baseUrl?: string
  email?: string
  apiToken?: string
}

export interface ConfluenceConnectionInfo {
  ok: boolean
  baseUrl: string
  user?: {
    accountId?: string
    displayName?: string
    email?: string
  }
}

export interface ConfluenceSearchResult {
  pageId: string
  title: string
  spaceKey?: string
  url: string
}

function buildProxyUrl(path: string): string {
  const base = CONFLUENCE_PROXY_URL.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function loadConfluencePage(reference: string): Promise<ConfluencePageContent> {
  const trimmedReference = reference.trim()
  if (!trimmedReference) {
    throw new ConfluenceError('Bitte einen Confluence-Link oder eine Page-ID eingeben.')
  }

  const settings = useSettingsStore()
  const credentials: ConfluenceCredentialsPayload = {
    baseUrl: settings.confluenceBaseUrl.trim() || undefined,
    email: settings.confluenceEmail.trim() || undefined,
    apiToken: settings.confluenceApiToken.trim() || undefined,
  }

  let response: Response
  try {
    response = await fetch(buildProxyUrl('/confluence/page'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference: trimmedReference, credentials }),
    })
  } catch {
    throw new ConfluenceError(
      `Der lokale Confluence-Proxy ist nicht erreichbar (${CONFLUENCE_PROXY_URL}). Bitte zuerst \`npm run confluence:proxy\` starten.`,
    )
  }

  const payload = await parseJson(response)
  if (!response.ok) {
    const errorMessage = typeof payload.error === 'string'
      ? payload.error
      : 'Confluence-Seite konnte nicht geladen werden.'
    throw new ConfluenceError(errorMessage)
  }

  return payload as unknown as ConfluencePageContent
}

export async function testConfluenceConnection(
  baseUrl: string,
  email: string,
  apiToken: string,
): Promise<ConfluenceConnectionInfo> {
  const credentials: ConfluenceCredentialsPayload = {
    baseUrl: baseUrl.trim() || undefined,
    email: email.trim() || undefined,
    apiToken: apiToken.trim() || undefined,
  }

  let response: Response
  try {
    response = await fetch(buildProxyUrl('/confluence/test'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credentials }),
    })
  } catch {
    throw new ConfluenceError(
      `Der lokale Confluence-Proxy ist nicht erreichbar (${CONFLUENCE_PROXY_URL}). Bitte zuerst npm run confluence:proxy starten.`,
    )
  }

  const payload = await parseJson(response)
  if (!response.ok) {
    const errorMessage = typeof payload.error === 'string'
      ? payload.error
      : 'Confluence-Verbindung konnte nicht getestet werden.'
    throw new ConfluenceError(errorMessage)
  }

  return payload as unknown as ConfluenceConnectionInfo
}

export async function searchConfluencePages(
  query: string,
  limit = 8,
): Promise<ConfluenceSearchResult[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) {
    throw new ConfluenceError('Bitte mindestens 2 Zeichen für die Confluence-Suche eingeben.')
  }

  const settings = useSettingsStore()
  const credentials: ConfluenceCredentialsPayload = {
    baseUrl: settings.confluenceBaseUrl.trim() || undefined,
    email: settings.confluenceEmail.trim() || undefined,
    apiToken: settings.confluenceApiToken.trim() || undefined,
  }

  let response: Response
  try {
    response = await fetch(buildProxyUrl('/confluence/search'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: trimmedQuery, limit, credentials }),
    })
  } catch {
    throw new ConfluenceError(
      `Der lokale Confluence-Proxy ist nicht erreichbar (${CONFLUENCE_PROXY_URL}). Bitte zuerst npm run confluence:proxy starten.`,
    )
  }

  const payload = await parseJson(response)
  if (!response.ok) {
    const errorMessage = typeof payload.error === 'string'
      ? payload.error
      : 'Confluence-Suche konnte nicht ausgeführt werden.'
    throw new ConfluenceError(errorMessage)
  }

  const results = Array.isArray(payload.results) ? payload.results : []
  return results as ConfluenceSearchResult[]
}

export function toImportedConfluenceContext(page: ConfluencePageContent): ImportedConfluenceContext {
  return {
    sourceType: 'confluence-page',
    sourceId: page.pageId,
    sourceUrl: page.url,
    title: page.title,
    spaceKey: page.spaceKey,
    text: page.text,
    importedAt: new Date().toISOString(),
  }
}
