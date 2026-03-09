/**
 * Generate a short session title from the first user prompt and assistant response.
 * Used when the agent harness (OpenCode, Codex, etc.) does not send session_info_update.
 *
 * @see https://agentclientprotocol.com/rfds/session-info-update
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-3-5-haiku-20241022'
const MAX_TITLE_LENGTH = 60

export interface GenerateTitleOptions {
  userPrompt: string
  assistantPreview?: string
  apiKey: string
}

/**
 * Call Anthropic API to generate a concise session title.
 * Returns null on failure (caller should keep existing fallback).
 */
export async function generateSessionTitle(options: GenerateTitleOptions): Promise<string | null> {
  const { userPrompt, assistantPreview, apiKey } = options
  const prompt = userPrompt.trim().slice(0, 500)
  const assistant = assistantPreview?.trim().slice(0, 300) ?? ''

  const systemPrompt = `You generate short session titles for coding agent chats. Output ONLY the title, no quotes or punctuation. Max ${MAX_TITLE_LENGTH} chars. Be specific and descriptive.`
  const userContent = assistant
    ? `User: ${prompt}\n\nAssistant (preview): ${assistant}\n\nTitle:`
    : `User: ${prompt}\n\nTitle:`

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 64,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!res.ok) {
      console.error('[generate-session-title] API error:', res.status, await res.text())
      return null
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = data.content?.[0]?.text?.trim()
    if (!text) return null

    const title = text.slice(0, MAX_TITLE_LENGTH).trim()
    return title || null
  } catch (err) {
    console.error('[generate-session-title] Error:', err)
    return null
  }
}
