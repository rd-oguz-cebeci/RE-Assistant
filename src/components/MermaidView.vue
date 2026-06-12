<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ code: string }>()
const { show } = useToast()

const container = ref<HTMLElement | null>(null)
const errorMsg = ref('')
let renderId = 0

// Mermaid wird dynamisch geladen, damit es nicht im Haupt-Bundle landet.
type MermaidApi = typeof import('mermaid')['default']
let mermaidApi: MermaidApi | null = null

async function getMermaid(): Promise<MermaidApi> {
  if (!mermaidApi) {
    mermaidApi = (await import('mermaid')).default
    mermaidApi.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
  }
  return mermaidApi
}

async function render() {
  errorMsg.value = ''
  if (!container.value || !props.code.trim()) return
  try {
    const mermaid = await getMermaid()
    const { svg } = await mermaid.render(`mermaid-${renderId++}`, props.code)
    container.value.innerHTML = svg
  } catch (error) {
    errorMsg.value = (error as Error).message
  }
}

onMounted(render)
watch(() => props.code, render)

function copyCode() {
  navigator.clipboard.writeText(props.code)
  show('Mermaid-Code kopiert!', 'success')
}
</script>

<template>
  <div>
    <div ref="container" class="flex justify-center overflow-x-auto" />
    <p v-if="errorMsg" class="mt-2 text-xs text-red-500">
      Diagramm konnte nicht gerendert werden: {{ errorMsg }}
    </p>
    <details class="mt-3 rounded-lg border border-slate-200 dark:border-slate-700">
      <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-500">
        Mermaid-Quellcode
      </summary>
      <div class="relative">
        <button
          class="absolute right-2 top-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800"
          @click="copyCode"
        >
          <AppIcon name="copy" :size="12" class="inline" /> Kopieren
        </button>
        <pre class="overflow-x-auto p-3 text-xs"><code>{{ code }}</code></pre>
      </div>
    </details>
  </div>
</template>
