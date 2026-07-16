<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { testAtlassianConnection, AtlassianError } from '@/services/atlassian'
import { testConfluenceConnection } from '@/services/confluence'
import type { AiProvider } from '@/types'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const { show } = useToast()

type ConfigType = AiProvider | 'mcp' | 'atlassian' | 'confluence'

const configType = ref<ConfigType>(settings.provider)
const credential = ref('')
const mcpUrl = ref('')
const confluenceBaseUrl = ref('')
const confluenceEmail = ref('')
const confluenceApiToken = ref('')
const showKey = ref(false)
const isTesting = ref(false)

const atlDomain = ref('')
const atlEmail = ref('')
const atlToken = ref('')
const atlShowToken = ref(false)
const atlJiraProject = ref('')
const atlConfluenceSpace = ref('')
const atlTesting = ref(false)

const dialog = ref<HTMLElement | null>(null)
const firstField = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      configType.value = settings.provider
      credential.value = settings.apiKey
      mcpUrl.value = settings.mcpUrl
      confluenceBaseUrl.value = settings.confluenceBaseUrl
      confluenceEmail.value = settings.confluenceEmail
      confluenceApiToken.value = settings.confluenceApiToken
      showKey.value = false
      loadAtlassianFields()
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      firstField.value?.focus()
    } else if (lastFocused) {
      lastFocused.focus()
      lastFocused = null
    }
  },
)

watch(
  () => configType.value,
  (newType) => {
    if (newType === 'mcp') {
      credential.value = settings.mcpBearerToken
      mcpUrl.value = settings.mcpUrl
    } else if (newType === 'atlassian') {
      loadAtlassianFields()
    } else if (newType === 'confluence') {
      confluenceBaseUrl.value = settings.confluenceBaseUrl
      confluenceEmail.value = settings.confluenceEmail
      confluenceApiToken.value = settings.confluenceApiToken
    } else {
      credential.value = settings.apiKey
    }
    showKey.value = false
    atlShowToken.value = false
  },
)

function loadAtlassianFields() {
  atlDomain.value = settings.atlassianDomain
  atlEmail.value = settings.atlassianEmail
  atlToken.value = settings.atlassianToken
  atlJiraProject.value = settings.atlassianJiraProject
  atlConfluenceSpace.value = settings.atlassianConfluenceSpace
}

const placeholder = computed(() => {
  switch (configType.value) {
    case 'mcp':
      return 'MCP Bearer Token'
    case 'confluence':
      return 'Confluence API Token'
    case 'anthropic':
      return 'sk-ant-api03-...'
    case 'gemini':
    default:
      return 'AIzaSy...'
  }
})

const label = computed(() => {
  if (configType.value === 'mcp') return 'Bearer Token'
  if (configType.value === 'confluence') return 'Confluence API Token'
  return 'API Key'
})

const description = computed(() => {
  if (configType.value === 'atlassian') {
    return 'Verbinden Sie den RE-Assistenten mit Ihrer Atlassian Cloud. Alle Daten werden lokal im Browser gespeichert.'
  }
  if (configType.value === 'mcp') {
    return 'Optional: MCP Bearer Token eingeben. Wenn ein lokaler MCP-Proxy OAuth übernimmt, kann das Feld leer bleiben.'
  }
  if (configType.value === 'confluence') {
    return 'Pflegen Sie hier die Confluence-Zugangsdaten für den lokalen Import-Proxy.'
  }
  return 'Geben Sie Ihren API Key ein. Der Schlüssel wird nur lokal im Browser gespeichert.'
})

const hint = computed(() => {
  if (configType.value === 'mcp' || configType.value === 'atlassian') return ''
  if (configType.value === 'confluence') {
    return 'Confluence API Token in Atlassian unter Account Settings > Security > API tokens erstellen'
  }
  if (configType.value === 'anthropic') return 'Auf console.anthropic.com erstellen'
  return 'Kostenlos auf ai.google.dev erstellen'
})

function close() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return

  const focusable = dialog.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

onBeforeUnmount(() => {
  if (lastFocused) lastFocused.focus()
})

async function save() {
  if (configType.value === 'atlassian') {
    await saveAtlassian()
    return
  }

  if (configType.value === 'confluence') {
    const baseUrl = confluenceBaseUrl.value.trim()
    const email = confluenceEmail.value.trim()
    const apiToken = confluenceApiToken.value.trim()

    if (!baseUrl || !email || !apiToken) {
      show('Bitte Confluence Base URL, E-Mail und API Token vollständig eintragen.', 'error')
      return
    }

    settings.setConfluenceCredentials(baseUrl, email, apiToken)
    show('Confluence-Zugangsdaten gespeichert.', 'success')
    close()
    return
  }

  const cred = credential.value.trim()
  if (!cred) {
    if (configType.value === 'mcp') {
      settings.setMcpBearerToken('')
      settings.setMcpUrl(mcpUrl.value)
      show('MCP-Einstellungen gespeichert (ohne Browser-Token).', 'success')
      close()
      return
    }

    settings.setApiCredentials(configType.value as AiProvider, '')
    show('API Key entfernt. Demo-Modus kann jetzt ohne API geladen werden.', 'success')
    close()
    return
  }

  if (configType.value === 'mcp') {
    settings.setMcpBearerToken(cred)
    settings.setMcpUrl(mcpUrl.value)
    show('MCP-Einstellungen gespeichert.', 'success')
  } else {
    settings.setApiCredentials(configType.value as AiProvider, cred)
    show('API-Anbindung gespeichert.', 'success')
  }

  close()
}

async function saveAtlassian() {
  const domain = atlDomain.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const email = atlEmail.value.trim()
  const token = atlToken.value.trim()
  const jiraProject = atlJiraProject.value.trim().toUpperCase()
  const confluenceSpace = atlConfluenceSpace.value.trim().toUpperCase()

  if (!domain || !email || !token || !jiraProject) {
    show('Bitte Domain, E-Mail, API-Token und Jira-Projektschlüssel ausfüllen.', 'error')
    return
  }

  settings.setAtlassianConfig({ domain, email, token, jiraProject, confluenceSpace })
  show('Atlassian-Konfiguration gespeichert.', 'success')
  close()
}

async function testAtlassian() {
  const domain = atlDomain.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const email = atlEmail.value.trim()
  const token = atlToken.value.trim()
  const jiraProject = atlJiraProject.value.trim().toUpperCase()

  if (!domain || !email || !token || !jiraProject) {
    show('Bitte zuerst alle Pflichtfelder ausfüllen.', 'error')
    return
  }

  atlTesting.value = true
  try {
    const diagnostics = await testAtlassianConnection({
      domain,
      email,
      token,
      jiraProjectKey: jiraProject,
      confluenceSpaceKey: atlConfluenceSpace.value,
    })
    show(diagnostics.message, diagnostics.authOk && diagnostics.projectVisible ? 'success' : 'error')
  } catch (error) {
    const msg = error instanceof AtlassianError ? error.message : 'Verbindung fehlgeschlagen.'
    show(msg, 'error')
  } finally {
    atlTesting.value = false
  }
}

async function runConnectionTest() {
  if (configType.value !== 'confluence') return

  isTesting.value = true
  try {
    const baseUrl = confluenceBaseUrl.value.trim()
    const email = confluenceEmail.value.trim()
    const apiToken = confluenceApiToken.value.trim()

    if (!baseUrl || !email || !apiToken) {
      show('Bitte Confluence Base URL, E-Mail und API Token vollständig eintragen.', 'error')
      return
    }

    const result = await testConfluenceConnection(baseUrl, email, apiToken)
    const userName = result.user?.displayName?.trim() || 'Unbekannter Benutzer'
    show(`Confluence-Anbindung erfolgreich (${userName}).`, 'success')
  } catch (error) {
    let message = 'Anbindungstest fehlgeschlagen.'
    if (error instanceof Error) {
      message = error.message
    }
    if (message.toLowerCase().includes('not found')) {
      message = 'Confluence-Test-Endpoint nicht gefunden. Bitte lokalen Confluence-Proxy neu starten.'
    }
    show(message, 'error', 7000)
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    @click.self="close"
    @keydown="onKeydown"
  >
    <dialog
      ref="dialog"
      open
      aria-labelledby="api-modal-title"
      class="api-modal-dialog glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in sm:p-8"
    >
      <h3
        id="api-modal-title"
        class="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100"
      >
        <AppIcon name="key" :size="20" class="text-brand" /> KI-Anbindung
      </h3>
      <p class="mb-6 text-sm text-slate-600 dark:text-slate-300">{{ description }}</p>

      <label
        for="config-type"
        class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
      >
        Anbieter / Kontext
      </label>
      <select
        id="config-type"
        ref="firstField"
        v-model="configType"
        class="mb-6 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="gemini">Google Gemini (gemini-1.5-flash)</option>
        <option value="anthropic">Anthropic Claude (claude-sonnet-4)</option>
        <option value="atlassian">Atlassian Cloud (Jira + Confluence)</option>
        <option value="confluence">Confluence Import</option>
        <option value="mcp" disabled>MCP Atlassian (aktuell nicht genutzt)</option>
      </select>

      <template v-if="configType === 'atlassian'">
        <div class="space-y-4 mb-6">
          <div>
            <label class="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Atlassian-Domain <span class="text-red-500">*</span>
            </label>
            <input
              ref="firstField"
              v-model="atlDomain"
              type="text"
              placeholder="meinefirma.atlassian.net"
              autocomplete="off"
              class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              E-Mail (Atlassian-Account) <span class="text-red-500">*</span>
            </label>
            <input
              v-model="atlEmail"
              type="email"
              placeholder="max.mustermann@firma.de"
              autocomplete="off"
              class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              API-Token <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="atlToken"
                :type="atlShowToken ? 'text' : 'password'"
                placeholder="ATATT3x..."
                autocomplete="off"
                spellcheck="false"
                class="w-full rounded-xl border border-slate-300 bg-white p-3.5 pr-12 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                :aria-label="atlShowToken ? 'Verbergen' : 'Anzeigen'"
                @click="atlShowToken = !atlShowToken"
              >
                <AppIcon :name="atlShowToken ? 'eye-off' : 'eye'" :size="16" />
              </button>
            </div>
            <p class="mt-1 text-[11px] text-slate-400">Erstellen unter: id.atlassian.com → Sicherheit → API-Token</p>
          </div>
          <div>
            <label class="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Jira-Projektschlüssel <span class="text-red-500">*</span>
            </label>
            <input
              v-model="atlJiraProject"
              type="text"
              placeholder="REQ"
              autocomplete="off"
              class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm uppercase dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Confluence-Space-Schlüssel
            </label>
            <input
              v-model="atlConfluenceSpace"
              type="text"
              placeholder="RE"
              autocomplete="off"
              class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm uppercase dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        </div>

        <button
          type="button"
          class="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
          :disabled="atlTesting"
          @click="testAtlassian"
        >
          <AppIcon :name="atlTesting ? 'loader-circle' : 'zap'" :size="16" :class="{ 'animate-spin': atlTesting }" />
          {{ atlTesting ? 'Verbindung wird geprüft…' : 'Verbindung testen' }}
        </button>
      </template>

      <template v-else-if="configType === 'confluence'">
        <label for="confluence-base-url" class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Confluence Base URL
        </label>
        <input
          id="confluence-base-url"
          v-model="confluenceBaseUrl"
          type="url"
          placeholder="https://rewe.atlassian.net"
          autocomplete="off"
          spellcheck="false"
          class="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          @keydown.enter="save"
        />

        <label for="confluence-email" class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Atlassian E-Mail
        </label>
        <input
          id="confluence-email"
          v-model="confluenceEmail"
          type="email"
          placeholder="vorname.nachname@firma.tld"
          autocomplete="off"
          spellcheck="false"
          class="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          @keydown.enter="save"
        />

        <label for="confluence-token" class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Confluence API Token
        </label>
        <div class="relative mb-6">
          <input
            id="confluence-token"
            v-model="confluenceApiToken"
            :type="showKey ? 'text' : 'password'"
            placeholder="Atlassian API Token"
            autocomplete="off"
            spellcheck="false"
            class="w-full rounded-xl border border-slate-300 bg-white p-3.5 pr-12 text-sm dark:border-slate-600 dark:bg-slate-800"
            @keydown.enter="save"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            :aria-label="showKey ? 'Verbergen' : 'Anzeigen'"
            @click="showKey = !showKey"
          >
            <AppIcon :name="showKey ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>
      </template>

      <template v-else>
        <label :for="`credential-${configType}`" class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {{ label }}
        </label>
        <div class="relative mb-6">
          <input
            :id="`credential-${configType}`"
            ref="firstField"
            v-model="credential"
            :type="showKey ? 'text' : 'password'"
            :placeholder="placeholder"
            autocomplete="off"
            spellcheck="false"
            class="w-full rounded-xl border border-slate-300 bg-white p-3.5 pr-12 text-sm dark:border-slate-600 dark:bg-slate-800"
            @keydown.enter="save"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            :aria-label="showKey ? 'Verbergen' : 'Anzeigen'"
            @click="showKey = !showKey"
          >
            <AppIcon :name="showKey ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>

        <p v-if="hint" class="mb-6 text-[11px] text-slate-400 dark:text-slate-500">{{ hint }}</p>
      </template>

      <template v-if="configType === 'mcp'">
        <label for="mcp-url" class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          MCP-Endpunkt-URL
        </label>
        <input
          id="mcp-url"
          v-model="mcpUrl"
          type="url"
          placeholder="http://localhost:4000/api/mcp"
          autocomplete="off"
          spellcheck="false"
          class="mb-6 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          @keydown.enter="save"
        />
      </template>

      <p
        class="mb-6 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <AppIcon name="shield-alert" :size="16" class="mt-0.5 shrink-0" />
        <span v-if="configType === 'atlassian'">
          API-Token und E-Mail werden unverschlüsselt im <strong>localStorage</strong> gespeichert.
          Nutzen Sie die App nur auf einem vertrauenswürdigen Gerät. Alle Atlassian-Anfragen werden
          über den lokalen Vite-Dev-Proxy geleitet (VITE_ATLASSIAN_DOMAIN in .env.local).
        </span>
        <span v-else>
          Das {{ label }} wird unverschlüsselt im <strong>localStorage</strong> dieses Browsers
          abgelegt. Nutzen Sie die App nur auf einem vertrauenswürdigen Gerät und verwenden Sie
          einen Key mit eng begrenzten Rechten.
        </span>
      </p>

      <div class="flex justify-end gap-3">
        <button
          v-if="configType === 'confluence'"
          class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          :disabled="isTesting"
          @click="runConnectionTest"
        >
          {{ isTesting ? 'Teste...' : 'Anbindung testen' }}
        </button>
        <button
          class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="close"
        >
          Abbrechen
        </button>
        <button
          class="rounded-xl btn-brand px-5 py-2.5 text-sm font-semibold text-white"
          @click="save"
        >
          Speichern
        </button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.api-modal-dialog {
  margin: 0 auto;
  border: 0;
  color: inherit;
  position: static;
}

.api-modal-dialog::backdrop {
  background: transparent;
}
</style>
