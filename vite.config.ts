import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// GitHub Pages serviert das Projekt unter /<repo-name>/.
// In der CI wird GITHUB_ACTIONS gesetzt → Base-Pfad setzen; lokal '/' verwenden.
const base = process.env.GITHUB_ACTIONS ? '/RE-Assistant/' : '/'

// Content-Security-Policy nur in den Production-Build injizieren.
// Im Dev-Modus würde eine strikte CSP das Inline-Skript des Vite-HMR-Clients blockieren.
const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self' https://generativelanguage.googleapis.com https://api.anthropic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
].join('; ')

function cspPlugin(): Plugin {
    return {
        name: 'inject-csp-meta',
        apply: 'build',
        transformIndexHtml(html) {
            return html.replace(
                '</title>',
                `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
            )
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    base,
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [vue(), cspPlugin()],
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
