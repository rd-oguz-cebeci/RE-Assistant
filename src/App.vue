<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import { findTool, menuStructure } from '@/config/menu'
import TheSidebar from '@/components/TheSidebar.vue'
import TheHeader from '@/components/TheHeader.vue'
import HomeView from '@/components/HomeView.vue'
import AdvisorView from '@/components/AdvisorView.vue'
import ToolView from '@/components/ToolView.vue'
import ApiModal from '@/components/ApiModal.vue'
import ToastContainer from '@/components/ToastContainer.vue'

const store = useProjectStore()
const sidebarOpen = ref(false)
const apiOpen = ref(false)

const isHome = computed(() => store.activeView === 'home')
const activeTool = computed(() => findTool(store.activeView)?.tool ?? null)
const activeSection = computed(() => menuStructure.find((section) => section.id === store.activeView) ?? null)
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
        <AdvisorView v-else-if="store.activeView === 'advisor'" />
        <ToolView v-else-if="activeTool" :key="store.activeView" :tool-id="store.activeView" />
        <div
          v-else-if="activeSection"
          class="mx-auto max-w-4xl"
        >
          <div class="mb-6 flex items-start gap-4">
            <div class="rounded-2xl bg-brand-soft p-3 text-brand dark:text-brand-strong">
              <span class="text-xl font-extrabold">{{ activeSection.label.split('.')[0] }}</span>
            </div>
            <div>
              <h2 class="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                {{ activeSection.title }}
              </h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {{ activeSection.desc }}
              </p>
            </div>
          </div>

          <div class="mb-6 rounded-2xl border border-brand bg-brand-soft p-5 text-sm text-slate-700 dark:text-slate-200">
            <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand dark:text-brand-strong">
              Warum nach IREB CPRE?
            </div>
            <p>{{ activeSection.why }}</p>
          </div>

          <div class="glass-panel rounded-2xl border p-5">
            <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              Was passiert in dieser Säule?
            </h3>
            <p class="mb-5 text-sm text-slate-600 dark:text-slate-300">
              {{ activeSection.instruction }}
            </p>

            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-for="tool in activeSection.children"
                :key="tool.id"
                class="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft/70 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-brand dark:hover:bg-brand-soft/50"
                @click="store.setView(tool.id, activeSection.id)"
              >
                <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {{ tool.label }}
                </div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ tool.desc }}
                </div>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="mx-auto max-w-xl py-20 text-center text-slate-500">
          Ansicht nicht gefunden.
        </div>
      </main>
    </div>

    <ApiModal :open="apiOpen" @close="apiOpen = false" />
    <ToastContainer />
  </div>
</template>
