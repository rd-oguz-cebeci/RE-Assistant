import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'

const app = createApp(App)
app.use(createPinia())

// Persistierten Zustand & Theme vor dem Mount initialisieren.
useSettingsStore().applyTheme()
useProjectStore().load()

app.mount('#app')
