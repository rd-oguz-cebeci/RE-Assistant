<script setup lang="ts">
import { menuStructure } from '@/config/menu'
import { useProjectStore } from '@/stores/project'
import AppIcon from './AppIcon.vue'

defineProps<{ mobileOpen: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const store = useProjectStore()

function toggleAccordion(sectionId: string) {
  if (store.activeView === sectionId) {
    store.openAccordion = store.openAccordion === sectionId ? null : sectionId
  } else {
    store.openAccordion = sectionId
    store.activeView = sectionId
  }
}

function openTool(sectionId: string, toolId: string) {
  store.openAccordion = sectionId
  store.activeView = toolId
  store.activeTab = null
  emit('navigate')
}

function goHome() {
  store.setView('home')
  store.openAccordion = null
  emit('navigate')
}
</script>

<template>
  <aside
    id="app-sidebar"
    class="glass-panel fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r transition-transform duration-300 lg:static lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <!-- Brand -->
    <button
      class="flex items-center gap-3 px-5 py-5 text-left"
      @click="goHome"
    >
      <img src="/logo_re_assistent.png" alt="Logo" class="h-9 w-9 rounded-lg object-contain" />
      <div>
        <div class="text-sm font-extrabold leading-tight text-slate-800 dark:text-slate-100">
          RE AI Assistant
        </div>
        <div class="text-[11px] text-slate-500">IREB CPRE</div>
      </div>
    </button>

    <nav class="custom-scrollbar flex-1 overflow-y-auto px-3 pb-6">
      <button
        class="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
        :class="
          store.activeView === 'home'
            ? 'bg-brand text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        @click="goHome"
      >
        <AppIcon name="home" :size="18" /> Startseite
      </button>

      <button
        class="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
        :class="
          store.activeView === 'advisor'
            ? 'bg-brand text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        @click="store.setView('advisor')"
      >
        <AppIcon name="message-square" :size="18" /> IREB Berater
      </button>

      <div v-for="section in menuStructure" :key="section.id" class="mb-1">
        <button
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="toggleAccordion(section.id)"
        >
          <AppIcon :name="section.icon" :size="18" />
          <span class="flex-1 text-left">{{ section.label }}</span>
          <AppIcon
            name="chevron-down"
            :size="16"
            class="transition-transform"
            :class="{ 'rotate-180': store.openAccordion === section.id }"
          />
        </button>

        <div v-if="store.openAccordion === section.id" class="ml-3 mt-1 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          <button
            v-for="tool in section.children"
            :key="tool.id"
            class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
            :class="
              store.activeView === tool.id
                ? 'bg-brand-soft font-semibold text-brand dark:bg-brand-soft/40 dark:text-brand-strong'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            "
            @click="openTool(section.id, tool.id)"
          >
            <AppIcon :name="tool.icon" :size="15" class="shrink-0 opacity-70" />
            <span class="truncate">{{ tool.label }}</span>
          </button>
        </div>
      </div>
    </nav>
  </aside>
</template>
