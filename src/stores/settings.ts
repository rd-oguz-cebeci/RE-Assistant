import { defineStore } from 'pinia'
import type { AiProvider } from '@/types'

const KEY_API = 'gemini_api_key'
const KEY_PROVIDER = 'api_provider'
const KEY_MCP_BEARER_TOKEN = 'mcp_bearer_token'
const KEY_MCP_URL = 'mcp_url'
const KEY_THEME = 'theme'

const DEFAULT_MCP_URL = 'https://mcp.atlassian.com/v1/mcp'

function resolveDefaultMcpUrl(): string {
    return (
        (import.meta.env.VITE_MCP_PROXY_URL as string | undefined) ??
        (import.meta.env.VITE_MCP_URL as string | undefined) ??
        DEFAULT_MCP_URL
    )
}

interface SettingsState {
    apiKey: string
    provider: AiProvider
    mcpBearerToken: string
    mcpUrl: string
    isDark: boolean
}

function detectInitialTheme(): boolean {
    const stored = localStorage.getItem(KEY_THEME)
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useSettingsStore = defineStore('settings', {
    state: (): SettingsState => ({
        apiKey: localStorage.getItem(KEY_API) ?? '',
        provider: (localStorage.getItem(KEY_PROVIDER) as AiProvider) ?? 'gemini',
        mcpBearerToken: localStorage.getItem(KEY_MCP_BEARER_TOKEN) ?? '',
        mcpUrl: localStorage.getItem(KEY_MCP_URL) ?? resolveDefaultMcpUrl(),
        isDark: detectInitialTheme(),
    }),

    getters: {
        hasApiKey: (state) => state.apiKey.trim().length > 0,
    },

    actions: {
        setApiCredentials(provider: AiProvider, apiKey: string) {
            this.provider = provider
            this.apiKey = apiKey
            localStorage.setItem(KEY_PROVIDER, provider)
            if (apiKey) {
                localStorage.setItem(KEY_API, apiKey)
            } else {
                localStorage.removeItem(KEY_API)
            }
        },

        setMcpBearerToken(token: string) {
            this.mcpBearerToken = token
            if (token) {
                localStorage.setItem(KEY_MCP_BEARER_TOKEN, token)
            } else {
                localStorage.removeItem(KEY_MCP_BEARER_TOKEN)
            }
        },

        setMcpUrl(url: string) {
            const resolved = url.trim() || resolveDefaultMcpUrl()
            this.mcpUrl = resolved
            localStorage.setItem(KEY_MCP_URL, resolved)
        },

        applyTheme() {
            document.documentElement.classList.toggle('dark', this.isDark)
        },

        toggleTheme() {
            this.isDark = !this.isDark
            localStorage.setItem(KEY_THEME, this.isDark ? 'dark' : 'light')
            this.applyTheme()
        },
    },
})
