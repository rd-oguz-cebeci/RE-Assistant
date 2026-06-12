import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

/** Rendert Markdown zu HTML für die Anzeige der KI-Ergebnisse. */
export function renderMarkdown(text: string): string {
    return marked.parse(text ?? '', { async: false }) as string
}
