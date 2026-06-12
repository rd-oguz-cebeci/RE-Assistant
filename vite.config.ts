import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages serviert das Projekt unter /<repo-name>/.
// In der CI wird GITHUB_ACTIONS gesetzt → Base-Pfad setzen; lokal '/' verwenden.
const base = process.env.GITHUB_ACTIONS ? '/RE-Assistant/' : '/'

// https://vite.dev/config/
export default defineConfig({
    base,
    plugins: [vue()],
    // Quell-Static-Assets liegen in static/, der Build-Output in public/
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
