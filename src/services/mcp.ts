export class McpError extends Error {}

export const MCP_BEARER_TOKEN = import.meta.env.VITE_MCP_BEARER_TOKEN as string | undefined

function buildMcpUrl(baseUrl: string, path?: string): string {
    if (!path) return baseUrl
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    if (baseUrl.endsWith('/')) return `${baseUrl}${path.replace(/^\//, '')}`
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

export async function fetchMcpContext(path?: string, bearerToken?: string, mcpUrl?: string): Promise<Record<string, unknown>> {
    const base = mcpUrl?.trim() || 'https://mcp.atlassian.com/v1/mcp'
    const url = buildMcpUrl(base, path)
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    const token = bearerToken?.trim() || MCP_BEARER_TOKEN
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(url, {
        method: 'GET',
        headers,
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new McpError(`MCP request error: ${response.status} ${errorText}`)
    }

    return response.json()
}

export function serializeMcpContext(context: Record<string, unknown>): string {
    function formatValue(value: unknown, indent = 0): string {
        const prefix = ' '.repeat(indent)
        if (value === null || value === undefined) return `${prefix}null`
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return `${prefix}${value}`
        }
        if (Array.isArray(value)) {
            return value
                .map((item) => formatValue(item, indent + 2))
                .join('\n')
        }
        if (typeof value === 'object') {
            return Object.entries(value)
                .map(([key, nested]) => `${prefix}${key}:\n${formatValue(nested, indent + 2)}`)
                .join('\n')
        }
        return `${prefix}${String(value)}`
    }

    return formatValue(context, 0).trim()
}
