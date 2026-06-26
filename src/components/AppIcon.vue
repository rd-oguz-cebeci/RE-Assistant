<script setup lang="ts">
import { computed } from 'vue'
import { icons } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{ name: string; size?: number; strokeWidth?: number }>(),
  { size: 20, strokeWidth: 2 },
)

// Legacy-Iconnamen aus der ursprünglichen App auf aktuelle Lucide-Namen abbilden.
const LEGACY_ICON_ALIASES: Record<string, string> = {
  'file-edit': 'file-pen-line',
  'check-square': 'square-check-big',
  'box-select': 'box',
  'help-circle': 'circle-help',
  'alert-triangle': 'triangle-alert',
  sliders: 'sliders-horizontal',
}

/** Wandelt z. B. "git-merge" in "GitMerge" um, um das Lucide-Icon zu finden. */
const component = computed(() => {
  const lib = icons as Record<string, unknown>
  const resolvedName = LEGACY_ICON_ALIASES[props.name] ?? props.name
  const pascal = resolvedName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return lib[pascal] ?? lib.HelpCircle
})
</script>

<template>
  <component :is="component" :size="size" :stroke-width="strokeWidth" />
</template>
