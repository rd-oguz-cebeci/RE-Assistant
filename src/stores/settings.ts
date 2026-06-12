import { defineStore } from 'pinia'
import type { AiProvider } from '@/types'

const KEY_API = 'gemini_api_key'
const KEY_PROVIDER = 'api_provider'
const KEY_THEME = 'theme'

interface SettingsState {
    apiKey: string
    provider: AiProvider
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
            localStorage.setItem(KEY_API, apiKey)
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
