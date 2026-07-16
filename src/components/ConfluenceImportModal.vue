<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  loadConfluencePage,
  searchConfluencePages,
  toImportedConfluenceContext,
  type ConfluencePageContent,
  type ConfluenceSearchResult,
} from '@/services/confluence'
import { useProjectStore } from '@/stores/project'
import { useToast } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const project = useProjectStore()
const { show } = useToast()

const dialog = ref<HTMLElement | null>(null)
const firstField = ref<HTMLElement | null>(null)
const importMode = ref<'search' | 'link'>('search')
const reference = ref('')
const searchQuery = ref('')
const isLoading = ref(false)
const isSearching = ref(false)
const searchResults = ref<ConfluenceSearchResult[]>([])
const preview = ref<ConfluencePageContent | null>(null)
let lastFocused: HTMLElement | null = null

const activeContext = computed(() => project.activeConfluenceContext)
const canImport = computed(() => reference.value.trim().length > 0)
const canSearch = computed(() => searchQuery.value.trim().length >= 2)

watch(
  () => props.open,
  async (open) => {
    if (open) {
      importMode.value = 'search'
      reference.value = activeContext.value?.sourceUrl ?? ''
      searchQuery.value = ''
      searchResults.value = []
      preview.value = null
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      firstField.value?.focus()
    } else if (lastFocused) {
      lastFocused.focus()
      lastFocused = null
    }
  },
)

onBeforeUnmount(() => {
  if (lastFocused) lastFocused.focus()
})

function close() {
  emit('close')
}

function setImportMode(mode: 'search' | 'link') {
  importMode.value = mode
  nextTick(() => {
    firstField.value?.focus()
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return

  const focusable = dialog.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

async function loadPagePreview() {
  if (isLoading.value) return

  isLoading.value = true
  preview.value = null
  try {
    preview.value = await loadConfluencePage(reference.value)
    show('Confluence-Seite geladen.', 'success')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Confluence-Seite konnte nicht geladen werden.'
    show(message, 'error', 7000)
  } finally {
    isLoading.value = false
  }
}

async function runSearch() {
  if (isSearching.value || !canSearch.value) return

  isSearching.value = true
  searchResults.value = []
  try {
    const results = await searchConfluencePages(searchQuery.value, 8)
    searchResults.value = results
    if (results.length === 0) {
      show('Keine Confluence-Seiten zur Suche gefunden.', 'info')
    } else {
      show(`${results.length} Confluence-Seiten gefunden.`, 'success')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Confluence-Suche konnte nicht geladen werden.'
    show(message, 'error', 7000)
  } finally {
    isSearching.value = false
  }
}

async function selectSearchResult(result: ConfluenceSearchResult) {
  reference.value = result.pageId
  await loadPagePreview()
}

function useAsContext() {
  if (!preview.value) return
  project.setConfluenceContext(toImportedConfluenceContext(preview.value))
  show('Confluence-Kontext übernommen.', 'success')
  close()
}

function clearContext() {
  project.clearConfluenceContext()
  preview.value = null
  show('Confluence-Kontext entfernt.', 'info')
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
      aria-labelledby="confluence-modal-title"
      class="confluence-modal-dialog glass-panel w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl animate-in sm:p-8"
    >
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3
            id="confluence-modal-title"
            class="mb-2 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100"
          >
            <AppIcon name="book-open" :size="20" class="text-brand" /> Confluence importieren
          </h3>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Suche nach Confluence-Seiten oder lade eine Seite per Link/Page-ID und übernimm ihren Text als zusätzlichen KI-Kontext.
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Schließen"
          @click="close"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <div v-if="activeContext" class="mb-4 rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
        <div class="font-semibold">Aktiver Confluence-Kontext</div>
        <div class="mt-1 truncate">{{ activeContext.title }}</div>
        <div class="mt-1 text-xs opacity-80">{{ activeContext.sourceUrl }}</div>
      </div>

      <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <div class="font-semibold">Was bewirkt „Als Kontext übernehmen“?</div>
        <div class="mt-1">
          Die geladene Confluence-Seite wird als aktiver Zusatzkontext im Projekt gespeichert und bei KI-Aufrufen automatisch vorangestellt (Titel, Quelle, Textinhalt). So antwortet die KI gezielt mit Bezug auf diese Seite. Über „Kontext entfernen“ kann der Zusatzkontext jederzeit wieder gelöscht werden.
        </div>
      </div>

      <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-slate-900/50">
        <div class="grid grid-cols-2 gap-1" role="tablist" aria-label="Importmodus">
          <button
            type="button"
            role="tab"
            :aria-selected="importMode === 'search'"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="importMode === 'search'
              ? 'bg-white text-brand shadow-sm dark:bg-slate-800'
              : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/70'"
            @click="setImportMode('search')"
          >
            Suche
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="importMode === 'link'"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="importMode === 'link'
              ? 'bg-white text-brand shadow-sm dark:bg-slate-800'
              : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/70'"
            @click="setImportMode('link')"
          >
            Link / Page-ID
          </button>
        </div>
      </div>

      <div
        v-if="importMode === 'search'"
        class="mb-4 rounded-xl border border-brand bg-brand-soft/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
      >
        <label for="confluence-search" class="sr-only">Confluence-Suche</label>
        <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Confluence-Suche</div>
        <div class="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Empfohlen: Suche nach einem Begriff und wähle eine Seite aus den Treffern.
        </div>
        <div class="flex flex-wrap gap-3">
          <input
            id="confluence-search"
            ref="firstField"
            v-model="searchQuery"
            type="text"
            placeholder="z. B. Android Blueprint, Schnittstellen, Architektur"
            class="min-w-64 flex-1 rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            @keydown.enter.prevent="runSearch"
          />
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            :disabled="isSearching || !canSearch"
            @click="runSearch"
          >
            {{ isSearching ? 'Suche...' : 'Suchen' }}
          </button>
        </div>

        <div v-if="searchResults.length" class="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
          <button
            v-for="result in searchResults"
            :key="result.pageId"
            type="button"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            @click="selectSearchResult(result)"
          >
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ result.title }}</div>
            <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ID: {{ result.pageId }}
              <span v-if="result.spaceKey"> · Space: {{ result.spaceKey }}</span>
            </div>
          </button>
        </div>
      </div>

      <div
        v-else
        class="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40"
      >
        <label
          for="confluence-reference"
          class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          Confluence-Link oder Page-ID
        </label>
        <div class="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Alternative: Direkt einen Seitenlink oder eine bekannte Page-ID einfügen.
        </div>
        <textarea
          id="confluence-reference"
          ref="firstField"
          v-model="reference"
          rows="3"
          placeholder="z. B. https://rewe.atlassian.net/wiki/spaces/ABC/pages/123456789/... oder 123456789"
          class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </div>

      <div class="mb-6 flex flex-wrap gap-3">
        <button
          v-if="importMode === 'link'"
          type="button"
          class="rounded-xl btn-brand px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isLoading || !canImport"
          @click="loadPagePreview"
        >
          {{ isLoading ? 'Lade Seite...' : 'Seite laden' }}
        </button>
        <button
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          :disabled="!activeContext"
          @click="clearContext"
        >
          Kontext entfernen
        </button>
      </div>

      <div v-if="preview" class="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <h4 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ preview.title }}</h4>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Page-ID: {{ preview.pageId }}
              <span v-if="preview.spaceKey"> · Space: {{ preview.spaceKey }}</span>
            </p>
          </div>
          <a
            :href="preview.url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Seite öffnen
          </a>
        </div>

        <div class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Textvorschau</div>
        <pre class="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-3 text-xs text-slate-700 dark:bg-slate-950/70 dark:text-slate-100">{{ preview.text }}</pre>
      </div>

      <div class="flex justify-end gap-3">
        <button
          class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="close"
        >
          Schließen
        </button>
        <button
          class="rounded-xl btn-brand px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!preview"
          @click="useAsContext"
        >
          Als Kontext übernehmen
        </button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.confluence-modal-dialog {
  margin: 0 auto;
  border: 0;
  color: inherit;
  position: static;
}

.confluence-modal-dialog::backdrop {
  background: transparent;
}
</style>
