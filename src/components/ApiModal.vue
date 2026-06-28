<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import type { AiProvider } from '@/types'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const { show } = useToast()

type ConfigType = AiProvider | 'mcp'

const configType = ref<ConfigType>(settings.provider)
const credential = ref('')
const showKey = ref(false)

const dialog = ref<HTMLElement | null>(null)
const firstField = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      configType.value = settings.provider
      credential.value = settings.apiKey
      showKey.value = false
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
    } else {
      credential.value = settings.apiKey
    }
    showKey.value = false
  },
)

const placeholder = computed(() => {
  switch (configType.value) {
    case 'mcp':
      return 'MCP Bearer Token'
    case 'anthropic':
      return 'sk-ant-api03-...'
    case 'gemini':
    default:
      return 'AIzaSy...'
  }
})

const label = computed(() => {
  return configType.value === 'mcp' ? 'Bearer Token' : 'API Key'
})

const description = computed(() => {
  if (configType.value === 'mcp') {
    return 'Geben Sie Ihren MCP Bearer Token ein. Das Token wird nur lokal im Browser gespeichert.'
  }
  return 'Geben Sie Ihren API Key ein. Der Schlüssel wird nur lokal im Browser gespeichert.'
})

const hint = computed(() => {
  if (configType.value === 'mcp') {
    return ''
  }
  if (configType.value === 'anthropic') {
    return 'Auf console.anthropic.com erstellen'
  }
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

function save() {
  const cred = credential.value.trim()

  if (!cred) {
    if (configType.value === 'mcp') {
      show(`Bitte einen Wert für ${label.value} eingeben.`, 'error')
      return
    }
    // Für Gemini/Anthropic: leere Eingabe erlaubt = Key löschen
    settings.setApiCredentials(configType.value as AiProvider, '')
    show('API Key entfernt. Demo-Modus kann jetzt ohne API geladen werden.', 'success')
    close()
    return
  }

  if (configType.value === 'mcp') {
    settings.setMcpBearerToken(cred)
    show('MCP Bearer Token gespeichert.', 'success')
  } else {
    settings.setApiCredentials(configType.value as AiProvider, cred)
    show('API-Anbindung gespeichert.', 'success')
  }

  close()
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    @click.self="close"
    @keydown="onKeydown"
  >
    <div
      ref="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-modal-title"
      class="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in sm:p-8"
    >
      <h3
        id="api-modal-title"
        class="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100"
      >
        <AppIcon name="key" :size="20" class="text-blue-600" /> KI-Anbindung
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
        <option value="mcp">MCP Atlassian</option>
      </select>

      <label
        :for="`credential-${configType}`"
        class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
      >
        {{ label }}
      </label>
      <div class="relative mb-6">
        <input
          :id="`credential-${configType}`"
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

      <p
        class="mb-6 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <AppIcon name="shield-alert" :size="16" class="mt-0.5 shrink-0" />
        <span>
          Das {{ label }} wird unverschlüsselt im <strong>localStorage</strong> dieses Browsers
          abgelegt. Nutzen Sie die App nur auf einem vertrauenswürdigen Gerät und verwenden Sie
          einen Key mit eng begrenzten Rechten.
        </span>
      </p>

      <div class="flex justify-end gap-3">
        <button
          class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="close"
        >
          Abbrechen
        </button>
        <button
          class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          @click="save"
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
</template>
