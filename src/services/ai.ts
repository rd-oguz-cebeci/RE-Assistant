import { useSettingsStore } from '@/stores/settings'
import { fetchMcpContext, serializeMcpContext, MCP_PROXY_URL, MCP_URL, MCP_BEARER_TOKEN } from '@/services/mcp'

/** Vom KI-Service ausgelöster Fehler (für gezielte Toast-Meldungen). */
export class AiError extends Error { }

const GEMINI_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
]
const ANTHROPIC_MODELS = ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022']

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

let cachedMcpContext: string | null | undefined

async function maybeAttachMcpContext(systemInstruction: string, bearerToken?: string): Promise<string> {
    const activeToken = bearerToken?.trim() || undefined
    const shouldFetchMcp = MCP_PROXY_URL || MCP_URL || MCP_BEARER_TOKEN || activeToken
    if (!shouldFetchMcp) return systemInstruction

    if (cachedMcpContext === undefined) {
        try {
            const contextData = await fetchMcpContext(undefined, activeToken)
            const serialized = serializeMcpContext(contextData).trim()
            cachedMcpContext = serialized || null
        } catch {
            cachedMcpContext = null
        }
    }

    if (!cachedMcpContext) return systemInstruction
    return `MCP-Kontext:\n${cachedMcpContext}\n\n${systemInstruction}`
}

/**
 * Ruft den konfigurierten KI-Anbieter auf und liefert den Antworttext.
 * Wirft {@link AiError} mit aussagekräftiger Meldung bei Fehlern.
 *
 * Wenn `VITE_MCP_PROXY_URL` gesetzt ist, wird MCP-Kontext vor dem System-Prompt
 * eingebunden, um den KI-Aufruf mit zusätzlichen Kontextinformationen zu versorgen.
 */
export async function callAi(prompt: string, systemInstruction = ''): Promise<string> {
    const settings = useSettingsStore()
    const mergedInstruction = await maybeAttachMcpContext(systemInstruction, settings.mcpBearerToken)
    const apiKey = settings.apiKey.trim()

    if (!apiKey) {
        throw new AiError('Kein API-Key hinterlegt. Bitte zuerst die KI-Anbindung konfigurieren.')
    }

    if (settings.provider === 'anthropic') {
        return callAnthropic(prompt, mergedInstruction, apiKey)
    }
    return callGemini(prompt, mergedInstruction, apiKey)
}

async function callAnthropic(
    prompt: string,
    systemInstruction: string,
    apiKey: string,
): Promise<string> {
    let lastError = ''
    for (const model of ANTHROPIC_MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model,
                        max_tokens: 4096,
                        system:
                            systemInstruction ||
                            'Du bist ein IREB-zertifizierter Requirements Engineering Experte. Antworte auf Deutsch.',
                        messages: [{ role: 'user', content: prompt }],
                    }),
                })

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}))
                    lastError = errData?.error?.message ?? `HTTP ${response.status}`
                    if (response.status === 401 || response.status === 403) {
                        throw new AiError(`Anthropic: ${lastError}`)
                    }
                    if (response.status === 404) break // Modell nicht verfügbar → nächstes probieren
                    await delay(1000 * 2 ** attempt)
                    continue
                }

                const data = await response.json()
                return data?.content?.[0]?.text ?? 'Keine Antwort.'
            } catch (error) {
                if (error instanceof AiError) throw error
                lastError = (error as Error).message
                await delay(1000 * 2 ** attempt)
            }
        }
    }
    throw new AiError(`Anthropic API-Fehler: ${lastError}`)
}

async function callGemini(
    prompt: string,
    systemInstruction: string,
    apiKey: string,
): Promise<string> {
    let lastError = ''
    for (const model of GEMINI_MODELS) {
        // Der API-Key wird per Header übertragen (nicht als URL-Query),
        // damit er nicht in Browser-History, Proxy- oder Server-Logs landet.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
        }
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey,
                    },
                    body: JSON.stringify(payload),
                })

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}))
                    lastError = errData?.error?.message ?? `HTTP ${response.status}`
                    if ([400, 403, 404].includes(response.status)) break // nächstes Modell
                    await delay(1000 * 2 ** attempt)
                    continue
                }

                const data = await response.json()
                return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Keine Antwort.'
            } catch (error) {
                lastError = (error as Error).message
                await delay(1000 * 2 ** attempt)
            }
        }
    }
    throw new AiError(`Gemini API-Fehler: ${lastError}`)
}
