<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import { findTool } from '@/config/menu'
import TheSidebar from '@/components/TheSidebar.vue'
import TheHeader from '@/components/TheHeader.vue'
import HomeView from '@/components/HomeView.vue'
import ToolView from '@/components/ToolView.vue'
import ApiModal from '@/components/ApiModal.vue'
import ToastContainer from '@/components/ToastContainer.vue'

const store = useProjectStore()
const sidebarOpen = ref(false)
const apiOpen = ref(false)

const isHome = computed(() => store.activeView === 'home')
const activeTool = computed(() => findTool(store.activeView)?.tool ?? null)
</script>

<template>
  <div class="flex h-full overflow-hidden bg-mesh-light text-slate-800 transition-colors duration-500 dark:bg-mesh-dark dark:text-slate-100">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
      @click="sidebarOpen = false"
    />

    <TheSidebar :mobile-open="sidebarOpen" @navigate="sidebarOpen = false" />

    <div class="flex flex-1 flex-col overflow-hidden">
      <TheHeader
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @open-api="apiOpen = true"
      />

      <main class="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-8">
        <HomeView v-if="isHome" />
        <ToolView v-else-if="activeTool" :key="store.activeView" :tool-id="store.activeView" />
        <div v-else class="mx-auto max-w-xl py-20 text-center text-slate-500">
          Dieses Werkzeug wird in einer kommenden Iteration ergänzt.
        </div>
      </main>
    </div>

    <ApiModal :open="apiOpen" @close="apiOpen = false" />
    <ToastContainer />
  </div>
</template>
