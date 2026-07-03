import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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
    "connect-src 'self' https://generativelanguage.googleapis.com https://api.anthropic.com https://*.atlassian.net",
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
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    // Fallback-Domain, damit der Dev-Proxy auch ohne .env.local aktiv ist.
    // Analog zur fest verdrahteten Claude-Code-Lösung. Per VITE_ATLASSIAN_DOMAIN überschreibbar.
    const atlassianDomain = env.VITE_ATLASSIAN_DOMAIN?.trim() || 'rewe.atlassian.net'

    // Atlassian Cloud lehnt state-ändernde Requests (POST/PUT/DELETE) mit
    // "XSRF check failed" ab, wenn Jira den Request als Browser-Session erkennt.
    // Ist der Nutzer im selben Browser bei Atlassian eingeloggt, schickt der
    // Browser Session-Cookies mit; der Proxy leitet sie weiter → Jira nutzt die
    // Cookie-Session statt der Basic-Auth (API-Token) → XSRF-Schutz greift.
    // Lösung: Cookie/Origin/Referer entfernen, damit nur die Basic-Auth zählt.
    // GET ist vom XSRF-Check nicht betroffen.
    // Atlassian Cloud lehnt state-ändernde Requests (POST/PUT/DELETE) mit
    // "XSRF check failed" (403) ab, wenn Origin/Referer nicht zur Zieldomain
    // passen. Der Cloud-XSRF-Schutz ist Origin-basiert – daher setzen wir
    // Origin/Referer auf die Atlassian-Domain (same-origin) und entfernen den
    // Browser-Cookie, damit nur die Basic-Auth (API-Token) zählt.
    // GET ist vom XSRF-Check nicht betroffen.
    const stripBrowserOrigin: import('vite').ProxyOptions['configure'] = (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('cookie')
            proxyReq.setHeader('origin', `https://${atlassianDomain}`)
            proxyReq.setHeader('referer', `https://${atlassianDomain}`)
            proxyReq.setHeader('X-Atlassian-Token', 'no-check')
        })
    }

    return {
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
        server: {
            proxy: {
                '/api/atlassian/jira-agile': {
                    target: `https://${atlassianDomain}`,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace('/api/atlassian/jira-agile', '/rest/agile/1.0'),
                    configure: stripBrowserOrigin,
                },
                '/api/atlassian/jira': {
                    target: `https://${atlassianDomain}`,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace('/api/atlassian/jira', '/rest/api/3'),
                    configure: stripBrowserOrigin,
                },
                '/api/atlassian/wiki': {
                    target: `https://${atlassianDomain}`,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace('/api/atlassian/wiki', '/wiki/rest/api'),
                    configure: stripBrowserOrigin,
                },
            },
        },
    }
})
