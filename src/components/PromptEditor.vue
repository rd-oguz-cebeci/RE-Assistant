<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useToast } from '@/composables/useToast'
import { cacheKey, getDefaultPrompt } from '@/services/prompts'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ toolId: string; subKey?: string }>()

const store = useProjectStore()
const { show } = useToast()
const expanded = ref(false)

const key = computed(() => cacheKey(props.toolId, props.subKey))
const current = computed(
  () => store.customPrompts[key.value] ?? getDefaultPrompt(props.toolId, props.subKey),
)

const systemText = ref(current.value.system)
const userText = ref(current.value.user)

function open() {
  expanded.value = !expanded.value
  if (expanded.value) {
    systemText.value = current.value.system
    userText.value = current.value.user
  }
}

function save() {
  store.setCustomPrompt(key.value, {
    system: systemText.value.trim(),
    user: userText.value.trim(),
  })
  show('Prompt-Pattern gespeichert und aktiv!', 'success')
}

function reset() {
  store.clearCustomPrompt(key.value)
  const def = getDefaultPrompt(props.toolId, props.subKey)
  systemText.value = def.system
  userText.value = def.user
  show('Prompt-Pattern auf Standard zurückgesetzt.', 'success')
}
</script>

<template>
  <div class="mb-6 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-md">
    <button
      class="flex w-full items-center gap-3 p-4 text-sm font-bold text-slate-200 hover:bg-slate-700"
      @click="open"
    >
      <AppIcon name="terminal" :size="18" class="text-emerald-400" />
      KI-Prompt Pattern ansehen &amp; anpassen
      <AppIcon
        name="chevron-down"
        :size="16"
        class="ml-auto text-slate-400 transition-transform"
        :class="{ 'rotate-180': expanded }"
      />
    </button>

    <div v-if="expanded" class="space-y-4 border-t border-slate-700 bg-slate-900 px-4 pb-5 pt-4 sm:px-5">
      <div>
        <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          System-Prompt (Rolle &amp; Verhalten)
        </label>
        <textarea
          v-model="systemText"
          class="custom-scrollbar h-28 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-emerald-300"
        />
      </div>
      <div>
        <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          User-Prompt Template (Datenstruktur)
        </label>
        <textarea
          v-model="userText"
          class="custom-scrollbar h-16 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-emerald-300"
        />
      </div>
      <div class="flex justify-end gap-2.5 pt-1">
        <button
          class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          @click="reset"
        >
          Zurücksetzen
        </button>
        <button
          class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          @click="save"
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
</template>
