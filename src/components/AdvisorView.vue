<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { renderMarkdown } from '@/services/markdown'
import { callAi, AiError } from '@/services/ai'
import {
  ADVISOR_STEPS,
  advisorTurnSystemPrompt,
  advisorTurnUserPrompt,
  advisorAiSystemPrompt,
  advisorAiUserPrompt,
  buildLocalTurnReply,
  countCompletedSteps,
  collectAdvisorAnswers,
  detectStartPhaseFromArtifacts,
  formatUserStory,
  generateLocalAdvisorResult,
  getNextStep,
  phaseLabel,
  seedAnswersFromArtifacts,
} from '@/services/advisor'
import AppIcon from './AppIcon.vue'

const store = useProjectStore()
const settings = useSettingsStore()
const { show } = useToast()

const input = ref('')
const loading = ref(false)
const demoMode = ref(store.demoModeLoaded)

const messages = computed(() => store.advisorMessages)
const advisorAnswers = computed(() => store.advisorAnswers)
const currentPhase = computed(() => store.advisorCurrentPhase as 'elicitation' | 'documentation' | 'validation' | 'management')
const currentStep = computed(() => getNextStep(advisorAnswers.value, currentPhase.value))
const completedSteps = computed(() => countCompletedSteps(advisorAnswers.value))
const hasFinishedFlow = computed(() => store.advisorCompleted)

function addAssistant(text: string) {
  store.addAdvisorMessage({ role: 'assistant', text })
}

function addUser(text: string) {
  store.addAdvisorMessage({ role: 'user', text })
}

async function ensureConversationStarted() {
  if (messages.value.length) return

  const snapshot = {
    tempVision: store.tempVision,
    tempPersonaText: store.tempPersonaText,
    tempTranscript: store.tempTranscript,
    tempNote: store.tempNote,
    tempValReqText: store.tempValReqText,
    requirements: store.requirements,
    globalContext: store.globalContext,
  }
  const startPhase = detectStartPhaseFromArtifacts(snapshot)
  const seeded = seedAnswersFromArtifacts(snapshot)

  store.setAdvisorPhase(startPhase)
  Object.entries(seeded).forEach(([key, value]) => {
    if (!store.advisorAnswers[key]) {
      store.setAdvisorAnswer(key, value)
    }
  })

  const seededCount = countCompletedSteps(store.advisorAnswers)
  addAssistant(`Ich bin Ihr IREB-Berater. Wir starten in der CPRE-Phase **${phaseLabel(startPhase)}**.`)
  if (seededCount > 0) {
    addAssistant(`Ich habe ${seededCount} bereits bekannte Artefakte aus Ihrem Projektzustand übernommen und steige dort ein, wo noch Lücken sind.`)
  }

  const next = getNextStep(store.advisorAnswers, store.advisorCurrentPhase as 'elicitation' | 'documentation' | 'validation' | 'management')
  if (!next) {
    await finalizeStory()
    return
  }

  store.setAdvisorPhase(next.phase)
  addAssistant(`CPRE-Phase **${phaseLabel(next.phase)}** - ${next.question}`)
}

void ensureConversationStarted()

async function finalizeStory() {
  if (store.advisorCompleted) return

  const answers = collectAdvisorAnswers(store.advisorAnswers)
  const localResult = generateLocalAdvisorResult(answers)
  store.setAdvisorCompleted(true)

  if (demoMode.value || !settings.hasApiKey) {
    addAssistant(localResult)
    store.tempValReqText = formatUserStory(answers)
    store.save()
    return
  }

  try {
    const aiResult = await callAi(advisorAiUserPrompt(answers), advisorAiSystemPrompt())
    addAssistant(aiResult)
    store.tempValReqText = formatUserStory(answers)
    store.save()
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'KI-Antwort fehlgeschlagen. Lokale Fassung wurde verwendet.'
    show(msg, 'error')
    addAssistant(localResult)
    store.tempValReqText = formatUserStory(answers)
    store.save()
  }
}

async function sendDynamicFollowUp(step: (typeof ADVISOR_STEPS)[number], currentAnswer: string) {
  const next = getNextStep(store.advisorAnswers, step.phase)
  if (next) {
    store.setAdvisorPhase(next.phase)
  }

  if (demoMode.value || !settings.hasApiKey) {
    addAssistant(
      buildLocalTurnReply({
        currentPhase: step.phase,
        currentStep: step,
        nextStep: next,
      }),
    )
    return
  }

  try {
    const response = await callAi(
      advisorTurnUserPrompt({
        currentPhase: step.phase,
        currentStep: step,
        answer: currentAnswer,
        knownAnswers: store.advisorAnswers,
        suggestedNextQuestion: next?.question ?? 'Keine weitere Frage; bitte Abschluss signalisieren.',
      }),
      advisorTurnSystemPrompt(),
    )
    addAssistant(response)
  } catch (error) {
    const msg = error instanceof AiError ? error.message : 'Dynamische KI-Rückfrage fehlgeschlagen. Lokale Rückfrage verwendet.'
    show(msg, 'error')
    addAssistant(
      buildLocalTurnReply({
        currentPhase: step.phase,
        currentStep: step,
        nextStep: next,
      }),
    )
  }
}

async function submit() {
  const value = input.value.trim()
  if (!value) {
    show('Bitte eine Antwort eingeben.', 'error')
    return
  }

  if (hasFinishedFlow.value) {
    show('Der aktuelle Durchlauf ist abgeschlossen. Bitte Chat zurücksetzen.', 'error')
    return
  }

  const step = currentStep.value
  if (!step) {
    await finalizeStory()
    return
  }

  addUser(value)
  store.setAdvisorAnswer(step.key, value)
  input.value = ''

  loading.value = true
  try {
    const completedBefore = store.advisorCompleted
    await sendDynamicFollowUp(step, value)

    if (!getNextStep(store.advisorAnswers, store.advisorCurrentPhase as 'elicitation' | 'documentation' | 'validation' | 'management')) {
      await finalizeStory()
    }

    if (!completedBefore && store.advisorCompleted) {
      show('User Story erstellt.', 'success')
    }
  } finally {
    loading.value = false
  }
}

function useDemoAnswer() {
  if (hasFinishedFlow.value || !currentStep.value) return
  input.value = currentStep.value.demoAnswer
}

async function runDemoEndToEnd() {
  demoMode.value = true
  while (!hasFinishedFlow.value && currentStep.value) {
    input.value = currentStep.value.demoAnswer
    await submit()
  }
}

function resetChat() {
  store.clearAdvisorState()
  store.tempValReqText = ''
  store.save()
  void ensureConversationStarted()
  show('Berater-Chat wurde zurückgesetzt.', 'success')
}

function copyLastAssistantMessage() {
  const lastAssistant = [...messages.value].reverse().find((msg) => msg.role === 'assistant')
  if (!lastAssistant) return
  navigator.clipboard.writeText(lastAssistant.text)
  show('Letzte Berater-Antwort kopiert.', 'success')
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-6 flex items-start gap-4">
      <div class="rounded-2xl bg-brand-soft p-3 text-brand dark:text-brand-strong">
        <AppIcon name="message-square" :size="26" />
      </div>
      <div class="flex-1">
        <h2 class="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
          IREB Berater
        </h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Geführter Chat für Einsteiger: Von der Problemidee bis zu einer DoR-nahen User Story.
        </p>
      </div>
    </div>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <label class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <input v-model="demoMode" type="checkbox" class="h-4 w-4" />
        Demo-Modus (ohne API)
      </label>

      <button
        class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        :disabled="!currentStep || hasFinishedFlow"
        @click="useDemoAnswer"
      >
        <AppIcon name="sparkles" :size="14" />
        Demo-Antwort einsetzen
      </button>

      <button
        class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
        :disabled="!currentStep || hasFinishedFlow"
        @click="runDemoEndToEnd"
      >
        <AppIcon name="play" :size="14" />
        Demo komplett durchspielen
      </button>

      <button
        class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        @click="copyLastAssistantMessage"
      >
        <AppIcon name="copy" :size="14" />
        Antwort kopieren
      </button>

      <button
        class="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
        @click="resetChat"
      >
        <AppIcon name="rotate-ccw" :size="14" />
        Chat zurücksetzen
      </button>
    </div>

    <div class="glass-panel rounded-2xl border p-5">
      <div class="custom-scrollbar mb-4 max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="max-w-[90%] rounded-2xl px-4 py-3 text-sm"
          :class="msg.role === 'assistant' ? 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'ml-auto bg-brand text-white'"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="msg.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(msg.text)" />
          <div v-else class="whitespace-pre-wrap">{{ msg.text }}</div>
        </div>
      </div>

      <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {{ hasFinishedFlow ? 'Durchlauf abgeschlossen' : `CPRE-Phase: ${phaseLabel(currentPhase)} • Fortschritt: ${completedSteps} / ${ADVISOR_STEPS.length}` }}
      </div>

      <div class="flex gap-3">
        <textarea
          v-model="input"
          class="custom-scrollbar h-24 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/80"
          :placeholder="hasFinishedFlow ? 'Chat zurücksetzen für neuen Durchlauf' : 'Ihre Antwort...'
          "
          :disabled="loading || hasFinishedFlow"
        />
        <button
          class="inline-flex items-center justify-center gap-2 rounded-xl btn-brand px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          :disabled="loading || hasFinishedFlow"
          @click="submit"
        >
          <AppIcon :name="loading ? 'loader-circle' : 'send'" :size="16" :class="{ 'animate-spin': loading }" />
          Senden
        </button>
      </div>
    </div>
  </div>
</template>
