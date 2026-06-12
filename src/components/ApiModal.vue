<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import type { AiProvider } from '@/types'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const { show } = useToast()

const provider = ref<AiProvider>(settings.provider)
const apiKey = ref(settings.apiKey)
const showKey = ref(false)

const dialog = ref<HTMLElement | null>(null)
const firstField = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      provider.value = settings.provider
      apiKey.value = settings.apiKey
      showKey.value = false
      // Fokus-Auslöser merken, um ihn nach dem Schließen wiederherzustellen.
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      firstField.value?.focus()
    } else if (lastFocused) {
      lastFocused.focus()
      lastFocused = null
    }
  },
)

function close() {
  emit('close')
}

/** Tab-Fokus innerhalb des Dialogs halten (Focus-Trap) und Escape schließen. */
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

const placeholder = () =>
  provider.value === 'anthropic' ? 'sk-ant-...' : 'AIza...'

function save() {
  const key = apiKey.value.trim()
  if (!key) {
    show('Bitte einen API-Key eingeben.', 'error')
    return
  }
  settings.setApiCredentials(provider.value, key)
  show('KI-Anbindung gespeichert.', 'success')
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
      <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Wählen Sie den KI-Anbieter und geben Sie Ihren API Key ein. Der Schlüssel wird nur lokal
        im Browser gespeichert.
      </p>

      <label
        for="api-provider"
        class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
      >
        Anbieter
      </label>
      <select
        id="api-provider"
        ref="firstField"
        v-model="provider"
        class="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="gemini">Google Gemini (gemini-1.5-flash)</option>
        <option value="anthropic">Anthropic Claude (claude-sonnet-4)</option>
      </select>

      <label
        for="api-key"
        class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
      >
        API Key
      </label>
      <div class="relative mb-3">
        <input
          id="api-key"
          v-model="apiKey"
          :type="showKey ? 'text' : 'password'"
          :placeholder="placeholder()"
          autocomplete="off"
          spellcheck="false"
          class="w-full rounded-xl border border-slate-300 bg-white p-3.5 pr-12 text-sm dark:border-slate-600 dark:bg-slate-800"
          @keydown.enter="save"
        />
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          :aria-label="showKey ? 'API Key verbergen' : 'API Key anzeigen'"
          @click="showKey = !showKey"
        >
          <AppIcon :name="showKey ? 'eye-off' : 'eye'" :size="16" />
        </button>
      </div>

      <p
        class="mb-6 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <AppIcon name="shield-alert" :size="16" class="mt-0.5 shrink-0" />
        <span>
          Der Schlüssel wird unverschlüsselt im <strong>localStorage</strong> dieses Browsers
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
