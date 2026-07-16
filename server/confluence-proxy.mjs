import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
loadEnvFile(path.join(ROOT_DIR, '.env'))
loadEnvFile(path.join(ROOT_DIR, '.env.local'))

const PORT = Number(process.env.PORT ?? 8788)
const DEFAULT_CONFLUENCE_BASE_URL = (process.env.CONFLUENCE_BASE_URL ?? '').replace(/\/$/, '')
const DEFAULT_CONFLUENCE_EMAIL = process.env.CONFLUENCE_EMAIL ?? ''
const DEFAULT_CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN ?? ''

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? '').trim().replace(/\/$/, '')
}

function resolveConfluenceConfig(body) {
  const fromBody = body?.credentials ?? {}

  const baseUrl = normalizeBaseUrl(fromBody.baseUrl || DEFAULT_CONFLUENCE_BASE_URL)
  const email = String(fromBody.email || DEFAULT_CONFLUENCE_EMAIL).trim()
  const apiToken = String(fromBody.apiToken || DEFAULT_CONFLUENCE_API_TOKEN).trim()

  return { baseUrl, email, apiToken }
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}

  const rawText = Buffer.concat(chunks).toString('utf-8')
  return rawText ? JSON.parse(rawText) : {}
}

function parsePageId(reference) {
  const trimmed = String(reference ?? '').trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const queryPageId = url.searchParams.get('pageId')
    if (queryPageId && /^\d+$/.test(queryPageId)) return queryPageId

    const segments = url.pathname.split('/').filter(Boolean)
    const pagesIndex = segments.findIndex((segment) => segment.toLowerCase() === 'pages')
    if (pagesIndex >= 0) {
      const candidate = segments[pagesIndex + 1]
      if (candidate && /^\d+$/.test(candidate)) return candidate
    }

    const numericSegments = segments.filter((segment) => /^\d+$/.test(segment))
    return numericSegments.at(-1) ?? null
  } catch {
    return null
  }
}

function escapeCqlLiteral(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', String.raw`\"`)
}

function decodeHtmlEntities(value) {
  const htmlEntityMatcher = /&(?:nbsp|amp|lt|gt|quot);|&#39;|&#(\d+);/gi
  return value
    .replace(htmlEntityMatcher, (entity, code) => {
      const normalized = String(entity).toLowerCase()
      if (normalized === '&nbsp;') return ' '
      if (normalized === '&amp;') return '&'
      if (normalized === '&lt;') return '<'
      if (normalized === '&gt;') return '>'
      if (normalized === '&quot;') return '"'
      if (normalized === '&#39;') return "'"
      if (code) return String.fromCodePoint(Number(code))
      return entity
    })
 }

function htmlToText(html) {
  if (!html) return ''

  const blockTagMatcher = /<\s*\/?(?:br|p|div|li|h[1-6])\b[^>]*>/gi
  const scriptStyleMatcher = /<(script|style)\b[\s\S]*?<\/\1>/gi
  const plainTagMatcher = /<[^\r\n<>]*>/g

  let text = String(html)
    .replace(scriptStyleMatcher, '')
    .replace(blockTagMatcher, (tag) => {
      const normalized = tag.toLowerCase()
      if (normalized.startsWith('<br')) return '\n'
      if (normalized.startsWith('</p')) return '\n\n'
      if (normalized.startsWith('</div')) return '\n'
      if (normalized.startsWith('</li')) return '\n'
      if (normalized.startsWith('<li')) return '- '
      if (normalized.startsWith('</h')) return '\n\n'
      return tag
    })
    .replace(plainTagMatcher, ' ')

  text = decodeHtmlEntities(text)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .trim()

  return text
}

function buildAuthorizationHeader(email, apiToken) {
  const credentials = `${email}:${apiToken}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

function assertConfigured(config) {
  if (!config.baseUrl || !config.email || !config.apiToken) {
    throw new Error('Confluence-Zugangsdaten fehlen. Bitte im Pflegedialog Confluence Base URL, E-Mail und API Token pflegen oder lokal per ENV setzen.')
  }
}

async function fetchConfluencePage(pageId, config) {
  assertConfigured(config)

  const url = `${config.baseUrl}/wiki/rest/api/content/${pageId}?expand=body.storage,title,space,version`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthorizationHeader(config.email, config.apiToken),
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    if (response.status === 401 || response.status === 403) {
      throw new Error('Zugriff auf die Confluence-Seite wurde abgelehnt.')
    }
    if (response.status === 404) {
      throw new Error('Die angeforderte Confluence-Seite wurde nicht gefunden.')
    }
    throw new Error(`Confluence API-Fehler (${response.status}): ${errorText}`)
  }

  return response.json()
}

async function fetchConfluenceCurrentUser(config) {
  assertConfigured(config)

  const url = `${config.baseUrl}/wiki/rest/api/user/current`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthorizationHeader(config.email, config.apiToken),
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    if (response.status === 401 || response.status === 403) {
      throw new Error('Confluence-Zugriff abgelehnt. Bitte E-Mail und API-Token prüfen.')
    }
    throw new Error(`Confluence API-Fehler (${response.status}): ${errorText}`)
  }

  return response.json()
}

async function searchConfluencePages(query, limit, config) {
  assertConfigured(config)

  const trimmedQuery = String(query ?? '').trim()
  if (trimmedQuery.length < 2) {
    throw new Error('Bitte mindestens 2 Zeichen für die Confluence-Suche eingeben.')
  }

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 20) : 8
  const cql = `type=page and text ~ "${escapeCqlLiteral(trimmedQuery)}"`
  const url = new URL(`${config.baseUrl}/wiki/rest/api/content/search`)
  url.searchParams.set('cql', cql)
  url.searchParams.set('limit', String(safeLimit))
  url.searchParams.set('expand', 'space')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthorizationHeader(config.email, config.apiToken),
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    if (response.status === 401 || response.status === 403) {
      throw new Error('Confluence-Zugriff abgelehnt. Bitte E-Mail und API-Token prüfen.')
    }
    throw new Error(`Confluence API-Fehler (${response.status}): ${errorText}`)
  }

  const payload = await response.json()
  const results = Array.isArray(payload?.results) ? payload.results : []

  return results
    .map((entry) => ({
      pageId: String(entry?.id ?? ''),
      title: String(entry?.title ?? ''),
      spaceKey: typeof entry?.space?.key === 'string' ? entry.space.key : undefined,
      url: buildPageUrl(entry, config.baseUrl),
    }))
    .filter((entry) => entry.pageId && entry.title)
}

function buildPageUrl(page, baseUrl) {
  if (page?._links?.base && page?._links?.webui) {
    return `${page._links.base}${page._links.webui}`
  }
  if (baseUrl && page?.space?.key && page?.id) {
    return `${baseUrl}/wiki/spaces/${page.space.key}/pages/${page.id}`
  }
  return ''
}

function normalizePageResponse(page, baseUrl) {
  const html = page?.body?.storage?.value ?? ''
  return {
    pageId: String(page?.id ?? ''),
    title: String(page?.title ?? ''),
    spaceKey: typeof page?.space?.key === 'string' ? page.space.key : undefined,
    url: buildPageUrl(page, baseUrl),
    html,
    text: htmlToText(html),
  }
}

async function handleConfluencePage(req, res) {
  const body = await readJsonBody(req)
  const config = resolveConfluenceConfig(body)
  const pageId = parsePageId(body.reference)
  if (!pageId) {
    sendJson(res, 400, { error: 'Aus dem Input konnte keine Confluence-Page-ID ermittelt werden.' })
    return
  }

  const page = await fetchConfluencePage(pageId, config)
  const normalized = normalizePageResponse(page, config.baseUrl)
  if (!normalized.text) {
    sendJson(res, 502, { error: 'Der Seiteninhalt konnte nicht in lesbaren Text umgewandelt werden.' })
    return
  }

  sendJson(res, 200, normalized)
}

async function handleConfluenceTest(req, res) {
  const body = await readJsonBody(req)
  const config = resolveConfluenceConfig(body)
  const user = await fetchConfluenceCurrentUser(config)

  sendJson(res, 200, {
    ok: true,
    baseUrl: config.baseUrl,
    user: {
      accountId: user?.accountId,
      displayName: user?.displayName,
      email: user?.email,
    },
  })
}

async function handleConfluenceSearch(req, res) {
  const body = await readJsonBody(req)
  const config = resolveConfluenceConfig(body)
  const query = String(body?.query ?? '')
  const limit = body?.limit
  const results = await searchConfluencePages(query, limit, config)

  sendJson(res, 200, {
    ok: true,
    query,
    count: results.length,
    results,
  })
}

const ROUTE_HANDLERS = {
  'POST /confluence/page': handleConfluencePage,
  'POST /confluence/test': handleConfluenceTest,
  'POST /confluence/search': handleConfluenceSearch,
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true })
      return
    }

    const routeKey = `${req.method} ${req.url}`
    const handler = ROUTE_HANDLERS[routeKey]
    if (handler) {
      await handler(req, res)
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler im Confluence-Proxy.'
    sendJson(res, 500, { error: message })
  }
})

server.listen(PORT, () => {
  console.log(`[confluence-proxy] listening on http://localhost:${PORT}`)
})
