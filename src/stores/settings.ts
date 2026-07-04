import { defineStore } from 'pinia'
import type { AiProvider } from '@/types'

const KEY_API = 'gemini_api_key'
const KEY_PROVIDER = 'api_provider'
const KEY_MCP_BEARER_TOKEN = 'mcp_bearer_token'
const KEY_THEME = 'theme'
const KEY_ATLASSIAN = 'atlassian_config'

interface SettingsState {
    apiKey: string
    provider: AiProvider
    mcpBearerToken: string
    isDark: boolean
    atlassianDomain: string
    atlassianEmail: string
    atlassianToken: string
    atlassianJiraProject: string
    atlassianConfluenceSpace: string
}

interface AtlassianConfigStorage {
    domain: string
    email: string
    token: string
    jiraProject: string
    confluenceSpace: string
}

function loadAtlassianConfig(): AtlassianConfigStorage {
    try {
        const raw = localStorage.getItem(KEY_ATLASSIAN)
        if (raw) return JSON.parse(raw) as AtlassianConfigStorage
    } catch {
        // Ignore corrupt data.
    }
    return { domain: '', email: '', token: '', jiraProject: '', confluenceSpace: '' }
}

function detectInitialTheme(): boolean {
    const stored = localStorage.getItem(KEY_THEME)
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useSettingsStore = defineStore('settings', {
    state: (): SettingsState => {
        const atl = loadAtlassianConfig()
        return {
            apiKey: localStorage.getItem(KEY_API) ?? '',
            provider: (localStorage.getItem(KEY_PROVIDER) as AiProvider) ?? 'gemini',
            mcpBearerToken: localStorage.getItem(KEY_MCP_BEARER_TOKEN) ?? '',
            isDark: detectInitialTheme(),
            atlassianDomain: atl.domain,
            atlassianEmail: atl.email,
            atlassianToken: atl.token,
            atlassianJiraProject: atl.jiraProject,
            atlassianConfluenceSpace: atl.confluenceSpace,
        }
    },

    getters: {
        hasApiKey: (state) => state.apiKey.trim().length > 0,
        hasAtlassianConfig: (state) =>
            state.atlassianDomain.trim().length > 0 &&
            state.atlassianEmail.trim().length > 0 &&
            state.atlassianToken.trim().length > 0 &&
            state.atlassianJiraProject.trim().length > 0,
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

        setAtlassianConfig(config: {
            domain: string
            email: string
            token: string
            jiraProject: string
            confluenceSpace: string
        }) {
            this.atlassianDomain = config.domain.trim()
            this.atlassianEmail = config.email.trim()
            this.atlassianToken = config.token.trim()
            this.atlassianJiraProject = config.jiraProject.trim().toUpperCase()
            this.atlassianConfluenceSpace = config.confluenceSpace.trim().toUpperCase()

            const stored: AtlassianConfigStorage = {
                domain: this.atlassianDomain,
                email: this.atlassianEmail,
                token: this.atlassianToken,
                jiraProject: this.atlassianJiraProject,
                confluenceSpace: this.atlassianConfluenceSpace,
            }
            localStorage.setItem(KEY_ATLASSIAN, JSON.stringify(stored))
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
