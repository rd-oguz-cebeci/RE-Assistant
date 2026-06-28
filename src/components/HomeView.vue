<script setup lang="ts">
import { computed } from 'vue'
import { menuStructure, findTool } from '@/config/menu'
import { useProjectStore } from '@/stores/project'
import { useToast } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'

const store = useProjectStore()
const { show } = useToast()

const favoriteTools = computed(() =>
  store.favorites.map((id) => findTool(id)?.tool).filter((t): t is NonNullable<typeof t> => !!t),
)

function open(sectionId: string, toolId: string) {
  store.openAccordion = sectionId
  store.activeView = toolId
}

function openSection(sectionId: string) {
  store.openAccordion = sectionId
  store.activeView = sectionId
}

function loadSupermarktDemo() {
  store.loadSupermarktDemo()
  show('Supermarkt-Story geladen. Demo-Daten wurden übernommen.', 'success')
  open('elicitation', 'goals')
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-8 text-center">
      <img src="/logo_re_assistent.png" alt="Logo" class="mx-auto mb-4 h-16 w-16 object-contain" />
      <h1 class="text-2xl font-extrabold text-slate-800 dark:text-slate-100 sm:text-3xl">
        IREB RE AI Assistant
      </h1>
      <p class="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
        KI-gestützte Werkzeuge entlang der vier Säulen des IREB CPRE: Ermittlung, Dokumentation,
        Validierung und Management von Anforderungen.
      </p>
      <p class="mx-auto mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Der Demo-Modus lädt die Supermarkt-Story mit vorbefüllten Beispieldaten und zeigt so den
        roten Faden durch den RE-Prozess. Ohne Demo-Ladung bleiben die Eingabefelder leer.
      </p>
      <div class="mt-5 flex justify-center">
        <button
          class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          @click="loadSupermarktDemo"
        >
          <AppIcon name="flask-conical" :size="16" />
          Supermarkt-Demo laden
        </button>
      </div>
    </div>

    <!-- Favoriten -->
    <div v-if="favoriteTools.length" class="mb-8">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <AppIcon name="star" :size="16" class="text-amber-400" /> Favoriten
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="t in favoriteTools"
          :key="t.id"
          class="glass-panel flex items-center gap-3 rounded-xl border p-4 text-left transition-transform hover:-translate-y-0.5"
          @click="open(findTool(t.id)!.section.id, t.id)"
        >
          <AppIcon :name="t.icon" :size="20" class="text-blue-600" />
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- Säulen -->
    <div class="grid gap-5 md:grid-cols-2">
      <div
        v-for="section in menuStructure"
        :key="section.id"
        class="glass-panel rounded-2xl border p-6"
      >
        <button class="mb-3 flex items-center gap-3 text-left" @click="openSection(section.id)">
          <div class="rounded-xl bg-blue-600/10 p-2.5 text-blue-600 dark:text-blue-400">
            <AppIcon :name="section.icon" :size="22" />
          </div>
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ section.label }}</h3>
        </button>
        <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">{{ section.desc }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tool in section.children"
            :key="tool.id"
            class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-slate-300"
            @click="open(section.id, tool.id)"
          >
            {{ tool.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
