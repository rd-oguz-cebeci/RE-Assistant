import { useSettingsStore } from '@/stores/settings'

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

/**
 * Ruft den konfigurierten KI-Anbieter auf und liefert den Antworttext.
 * Wirft {@link AiError} mit aussagekräftiger Meldung bei Fehlern.
 *
 * Hinweis: Bei statischem Hosting (GitLab Pages) gibt es keinen Backend-Proxy.
 * Der API-Key wird – wie in der Ursprungs-App – pro Nutzer lokal gehalten.
 */
export async function callAi(prompt: string, systemInstruction = ''): Promise<string> {
    const settings = useSettingsStore()
    const apiKey = settings.apiKey.trim()

    if (!apiKey) {
        throw new AiError('Kein API-Key hinterlegt. Bitte zuerst die KI-Anbindung konfigurieren.')
    }

    if (settings.provider === 'anthropic') {
        return callAnthropic(prompt, systemInstruction, apiKey)
    }
    return callGemini(prompt, systemInstruction, apiKey)
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
        }
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
