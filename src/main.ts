import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import './style.css'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'

const app = createApp(App)
app.use(createPinia())

// Globaler Fehler-Handler: verhindert stille Abbrüche und liefert eine Konsolen-Spur.
app.config.errorHandler = (err, _instance, info) => {
    console.error('[App-Fehler]', info, err)
}

// Persistierten Zustand & Theme vor dem Mount initialisieren.
useSettingsStore().applyTheme()
useProjectStore().load()

app.mount('#app')
