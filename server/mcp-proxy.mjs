import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
loadEnvFile(path.join(ROOT_DIR, '.env'))
loadEnvFile(path.join(ROOT_DIR, '.env.local'))

const PORT = Number(process.env.PORT ?? 4000)
const MCP_ROUTE_PREFIX = '/api/mcp'
const MCP_UPSTREAM_URL = (process.env.MCP_UPSTREAM_URL ?? 'https://mcp.atlassian.com/v1/mcp/authv2').trim()
const MCP_STATIC_BEARER_TOKEN = (process.env.MCP_STATIC_BEARER_TOKEN ?? '').trim()
const MCP_UPSTREAM_TIMEOUT_MS = Number(process.env.MCP_UPSTREAM_TIMEOUT_MS ?? 20000)

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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  setCorsHeaders(res)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function stripRoutePrefix(url) {
  const normalized = String(url ?? '')
  if (!normalized.startsWith(MCP_ROUTE_PREFIX)) return null
  return normalized.slice(MCP_ROUTE_PREFIX.length)
}

function buildUpstreamUrl(suffix) {
  const base = MCP_UPSTREAM_URL.endsWith('/') ? MCP_UPSTREAM_URL : `${MCP_UPSTREAM_URL}/`
  const relative = suffix.startsWith('/') ? suffix.slice(1) : suffix
  return new URL(relative || '', base)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  return chunks.length ? Buffer.concat(chunks) : undefined
}

function buildUpstreamHeaders(req) {
  const headers = {}
  const incomingContentType = req.headers['content-type']
  const incomingAccept = req.headers.accept

  if (incomingContentType) headers['Content-Type'] = incomingContentType
  if (incomingAccept) headers.Accept = incomingAccept

  const incomingAuth = req.headers.authorization
  if (MCP_STATIC_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${MCP_STATIC_BEARER_TOKEN}`
  } else if (incomingAuth) {
    headers.Authorization = incomingAuth
  }

  return headers
}

async function proxyRequest(req, res) {
  const suffix = stripRoutePrefix(req.url)
  if (suffix === null) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const upstreamUrl = buildUpstreamUrl(suffix)
  const method = req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
  const headers = buildUpstreamHeaders(req)

  let upstreamResponse
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(MCP_UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP upstream request failed.'
    sendJson(res, 502, { error: message })
    return
  }

  const rawContentType = upstreamResponse.headers.get('content-type')
  const contentType = rawContentType || 'application/octet-stream'
  const payloadBuffer = Buffer.from(await upstreamResponse.arrayBuffer())

  res.statusCode = upstreamResponse.status
  setCorsHeaders(res)
  res.setHeader('Content-Type', contentType)
  res.end(payloadBuffer)
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    setCorsHeaders(res)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      routePrefix: MCP_ROUTE_PREFIX,
      upstreamUrl: MCP_UPSTREAM_URL,
      authMode: MCP_STATIC_BEARER_TOKEN ? 'static-bearer-token' : 'forwarded-or-none',
    })
    return
  }

  await proxyRequest(req, res)
})

server.listen(PORT, () => {
  console.log(`[mcp-proxy] listening on http://localhost:${PORT}`)
  console.log(`[mcp-proxy] proxying ${MCP_ROUTE_PREFIX} -> ${MCP_UPSTREAM_URL}`)
})
