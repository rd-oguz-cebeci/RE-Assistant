<script setup lang="ts">
import { ref, watch } from 'vue'
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

watch(
  () => props.open,
  (open) => {
    if (open) {
      provider.value = settings.provider
      apiKey.value = settings.apiKey
    }
  },
)

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
  emit('close')
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in sm:p-8">
      <h3 class="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
        <AppIcon name="key" :size="20" class="text-blue-600" /> KI-Anbindung
      </h3>
      <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Wählen Sie den KI-Anbieter und geben Sie Ihren API Key ein. Der Schlüssel wird nur lokal
        im Browser gespeichert.
      </p>

      <label class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Anbieter
      </label>
      <select
        v-model="provider"
        class="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="gemini">Google Gemini (gemini-1.5-flash)</option>
        <option value="anthropic">Anthropic Claude (claude-sonnet-4)</option>
      </select>

      <label class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        API Key
      </label>
      <input
        v-model="apiKey"
        type="password"
        :placeholder="placeholder()"
        class="mb-6 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
      />

      <div class="flex justify-end gap-3">
        <button
          class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="emit('close')"
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
