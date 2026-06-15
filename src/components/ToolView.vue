<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { findTool } from '@/config/menu'
import { useProjectStore } from '@/stores/project'
import { useToast } from '@/composables/useToast'
import { getEffectivePrompts } from '@/services/prompts'
import { renderMarkdown } from '@/services/markdown'
import { callAi, AiError } from '@/services/ai'
import AppIcon from './AppIcon.vue'
import PromptEditor from './PromptEditor.vue'

// Mermaid-Ansicht (inkl. Mermaid-Lib) erst bei Bedarf laden.
const MermaidView = defineAsyncComponent(() => import('./MermaidView.vue'))

const props = defineProps<{ toolId: string }>()

const store = useProjectStore()
const { favorites } = storeToRefs(store)
const { show } = useToast()

const found = computed(() => findTool(props.toolId))
const tool = computed(() => found.value?.tool ?? null)

const variantKeys = computed(() => Object.keys(tool.value?.promptPatterns ?? {}))
const selectedVariant = ref<string | undefined>(undefined)

const input = ref('')
const result = ref('')
const loading = ref(false)

const isModeling = computed(() => props.toolId === 'modeling')
const isFavorite = computed(() => favorites.value.includes(props.toolId))

/** Sinnvolle Vorbelegung der Eingabe je nach Werkzeug-Kontext. */
function initialInput(): string {
  switch (props.toolId) {
    case 'goals':
    case 'context':
    case 'stakeholder':
      return store.tempVision
    case 'persona':
      return store.tempPersonaText
    case 'extract_req':
      return store.tempTranscript
    case 'formulate':
      return store.tempNote
    case 'smells':
    case 'tests':
    case 'perspective':
    case 'devil':
    case 'compliance':
    case 'dor':
    case 'bva':
    case 'nfr':
      return store.tempValReqText
    default:
      return ''
  }
}

function resetForTool() {
  input.value = initialInput()
  result.value = ''
  selectedVariant.value = variantKeys.value[0]
}

watch(() => props.toolId, resetForTool, { immediate: true })

async function run() {
  if (!input.value.trim()) {
    show('Bitte zuerst eine Eingabe machen.', 'error')
    return
  }
  loading.value = true
  result.value = ''
  try {
    const { system, user } = getEffectivePrompts(
      props.toolId,
      input.value,
      {},
      selectedVariant.value,
    )
    result.value = await callAi(user, system)
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Unerwarteter Fehler.'
    show(msg, 'error')
  } finally {
    loading.value = false
  }
}

const mermaidCode = computed(() =>
  result.value.replace(/```mermaid/g, '').replace(/```/g, '').trim(),
)

function copyResult() {
  navigator.clipboard.writeText(result.value)
  show('Ergebnis kopiert!', 'success')
}
</script>

<template>
  <div v-if="tool" class="mx-auto max-w-3xl">
    <!-- Kopf -->
    <div class="mb-6 flex items-start gap-4">
      <div class="rounded-2xl bg-blue-600/10 p-3 text-blue-600 dark:text-blue-400">
        <AppIcon :name="tool.icon" :size="26" />
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-extrabold text-slate-800 dark:text-slate-100 sm:text-2xl">
            {{ tool.label }}
          </h2>
          <button
            class="rounded-lg p-1.5 transition-colors"
            :class="isFavorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'"
            :aria-label="isFavorite ? 'Favorit entfernen' : 'Als Favorit'"
            @click="store.toggleFavorite(toolId)"
          >
            <AppIcon name="star" :size="18" />
          </button>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ tool.desc }}</p>
      </div>
    </div>

    <!-- Warum-Box -->
    <div
      class="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-600 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-slate-300"
    >
      <div class="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
        <AppIcon name="lightbulb" :size="14" /> Warum nach IREB?
      </div>
      {{ tool.why }}
    </div>

    <div class="glass-panel rounded-2xl border p-5 sm:p-7">
      <p class="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
        {{ tool.instruction }}
      </p>

      <!-- Varianten (z. B. UML-Typ, DoR-Schema) -->
      <div v-if="variantKeys.length" class="mb-4">
        <label class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Variante
        </label>
        <select
          v-model="selectedVariant"
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
        >
          <option v-for="k in variantKeys" :key="k" :value="k">{{ k }}</option>
        </select>
      </div>

      <textarea
        v-model="input"
        class="custom-scrollbar mb-4 h-40 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/80"
        placeholder="Ihre Eingabe …"
      />

      <PromptEditor :tool-id="toolId" :sub-key="selectedVariant" />

      <button
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-60"
        :disabled="loading"
        @click="run"
      >
        <AppIcon :name="loading ? 'loader-circle' : 'sparkles'" :size="18" :class="{ 'animate-spin': loading }" />
        {{ loading ? 'KI arbeitet …' : 'Mit KI ausführen' }}
      </button>

      <!-- Ergebnis -->
      <div v-if="result" class="relative mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60" aria-live="polite" :aria-busy="loading">
        <button
          class="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          @click="copyResult"
        >
          <AppIcon name="copy" :size="14" /> Kopieren
        </button>

        <MermaidView v-if="isModeling" :code="mermaidCode" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="markdown-body text-sm text-slate-700 dark:text-slate-200" v-html="renderMarkdown(result)" />
      </div>
    </div>
  </div>
</template>
