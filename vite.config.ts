import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitLab Pages serviert das Projekt i.d.R. unter /<projektname>/.
// Über die Umgebungsvariable PAGES_BASE kann der Pfad in der CI gesetzt werden.
// Lokal (dev/preview) wird '/' verwendet.
const base = process.env.PAGES_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
    base,
    plugins: [vue()],
    // Quell-Static-Assets liegen in static/, der Build-Output in public/
    // (GitLab Pages veröffentlicht das public/-Verzeichnis direkt).
    publicDir: 'static',
    build: {
        outDir: 'public',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
