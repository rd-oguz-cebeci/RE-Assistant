<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { viewTitles } from '@/config/menu'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ 'toggle-sidebar': []; 'open-api': [] }>()

const store = useProjectStore()
const settings = useSettingsStore()

const title = computed(() => viewTitles[store.activeView] ?? 'RE AI Assistant')
</script>

<template>
  <header class="glass-header sticky top-0 z-20 flex items-center gap-3 px-4 py-3 sm:px-6">
    <button
      class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
      aria-label="Menü"
      @click="emit('toggle-sidebar')"
    >
      <AppIcon name="menu" :size="20" />
    </button>

    <h1 class="flex-1 truncate text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">
      {{ title }}
    </h1>

    <button
      class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      :class="
        settings.hasApiKey
          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
          : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
      "
      @click="emit('open-api')"
    >
      <AppIcon name="key" :size="16" />
      <span class="hidden sm:inline">{{ settings.hasApiKey ? 'KI verbunden' : 'KI einrichten' }}</span>
    </button>

    <button
      v-if="!settings.hasApiKey"
      class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
      :title="'Demo-Modus: Supermarkt-Story ist vorausgefüllt'"
    >
      <AppIcon name="zap-off" :size="16" />
      <span class="hidden sm:inline">Demo-Modus (Supermarkt-Story)</span>
      <span class="sm:hidden">Demo</span>
    </button>

    <button
      class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label="Theme wechseln"
      @click="settings.toggleTheme()"
    >
      <AppIcon :name="settings.isDark ? 'sun' : 'moon'" :size="18" />
    </button>
  </header>
</template>
