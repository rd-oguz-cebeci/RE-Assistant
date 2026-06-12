<script setup lang="ts">
import { computed } from 'vue'
import { icons } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{ name: string; size?: number; strokeWidth?: number }>(),
  { size: 20, strokeWidth: 2 },
)

/** Wandelt z. B. "git-merge" in "GitMerge" um, um das Lucide-Icon zu finden. */
const component = computed(() => {
  const lib = icons as Record<string, unknown>
  const pascal = props.name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return lib[pascal] ?? lib.HelpCircle
})
</script>

<template>
  <component :is="component" :size="size" :stroke-width="strokeWidth" />
</template>
