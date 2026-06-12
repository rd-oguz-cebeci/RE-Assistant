import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

// Externe Links sicher öffnen (rel=noopener) – ohne dass DOMPurify sie entfernt.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer')
    }
})

/**
 * Rendert Markdown zu HTML für die Anzeige der KI-Ergebnisse.
 * Das Ergebnis wird mit DOMPurify bereinigt, da es per v-html eingefügt wird
 * und die KI-Antwort potenziell schädliches HTML/Script enthalten kann (XSS).
 */
export function renderMarkdown(text: string): string {
    const rawHtml = marked.parse(text ?? '', { async: false }) as string
    return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
}
