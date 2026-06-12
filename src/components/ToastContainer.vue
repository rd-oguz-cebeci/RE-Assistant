<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'

const { toasts, dismiss } = useToast()

const styles: Record<string, string> = {
  success: 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
  error: 'border-red-500 text-red-700 dark:text-red-300',
  info: 'border-blue-500 text-blue-700 dark:text-blue-300',
}
const iconNames: Record<string, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
}
</script>

<template>
  <div
    class="fixed bottom-4 sm:bottom-6 left-4 sm:left-auto right-4 sm:right-6 z-50 flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="glass-panel pointer-events-auto flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 shadow-lg animate-in"
      :class="styles[t.type]"
      role="status"
      @click="dismiss(t.id)"
    >
      <AppIcon :name="iconNames[t.type]" :size="18" />
      <span class="text-sm font-medium text-slate-700 dark:text-slate-100">{{ t.message }}</span>
    </div>
  </div>
</template>
