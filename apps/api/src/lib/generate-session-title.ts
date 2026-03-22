/**
 * Generate a short session title from the first user prompt and assistant response.
 * Used when the agent harness (OpenCode, Codex, etc.) does not send session_info_update.
 *
 * Priority: Bankr → Anthropic → OpenAI.
 * Uses the cheapest available model to keep title generation fast and inexpensive.
 */

import { bankrMessages, toBankrModelId } from './bankr'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const BANKR_TITLE_MODEL = 'claude-haiku-4.5'
const ANTHROPIC_FALLBACK_MODEL = 'claude-haiku-4-5-20251001'
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini'
const MAX_TITLE_LENGTH = 60

const SYSTEM_PROMPT = `You generate short session titles for coding agent chats. Output ONLY the title, no quotes or punctuation. Max ${MAX_TITLE_LENGTH} chars. Be specific and descriptive.`

export interface GenerateTitleOptions {
  userPrompt: string
  assistantPreview?: string
  anthropicApiKey?: string
  openaiApiKey?: string
  bankrApiKey?: string
}

function buildUserContent(userPrompt: string, assistantPreview?: string): string {
  const prompt = userPrompt.trim().slice(0, 500)
  const assistant = assistantPreview?.trim().slice(0, 300) ?? ''
  return assistant
    ? `User: ${prompt}\n\nAssistant (preview): ${assistant}\n\nTitle:`
    : `User: ${prompt}\n\nTitle:`
}

async function generateViaAnthropic(
  userContent: string,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_FALLBACK_MODEL,
      max_tokens: 64,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!res.ok) {
    console.error('[generate-session-title] Anthropic API error:', res.status, await res.text())
    return null
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  return data.content?.[0]?.text?.trim().slice(0, MAX_TITLE_LENGTH) || null
}

async function generateViaOpenAI(
  userContent: string,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_FALLBACK_MODEL,
      max_tokens: 64,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    console.error('[generate-session-title] OpenAI API error:', res.status, await res.text())
    return null
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim().slice(0, MAX_TITLE_LENGTH) || null
}

async function generateViaBankr(
  userContent: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await bankrMessages({
      apiKey,
      model: BANKR_TITLE_MODEL,
      max_tokens: 64,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    if (!res.ok) {
      console.error('[generate-session-title] Bankr API error:', res.status, await res.text())
      return null
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    return data.content?.[0]?.text?.trim().slice(0, MAX_TITLE_LENGTH) || null
  } catch (err) {
    console.error('[generate-session-title] Bankr error:', err)
    return null
  }
}

/**
 * Generate a concise session title using the cheapest available LLM.
 * Tries Bankr first, then Anthropic, then OpenAI.
 * Returns null on failure (caller should keep existing fallback).
 */
export async function generateSessionTitle(options: GenerateTitleOptions): Promise<string | null> {
  const { userPrompt, assistantPreview, anthropicApiKey, openaiApiKey, bankrApiKey } = options

  if (!userPrompt.trim()) return null

  const userContent = buildUserContent(userPrompt, assistantPreview)

  try {
    if (bankrApiKey) {
      const title = await generateViaBankr(userContent, bankrApiKey)
      if (title) return title
    }

    if (anthropicApiKey) {
      const title = await generateViaAnthropic(userContent, anthropicApiKey)
      if (title) return title
    }

    if (openaiApiKey) {
      const title = await generateViaOpenAI(userContent, openaiApiKey)
      if (title) return title
    }

    if (!bankrApiKey && !anthropicApiKey && !openaiApiKey) {
      console.warn('[generate-session-title] No API keys available for title generation')
    }

    return null
  } catch (err) {
    console.error('[generate-session-title] Error:', err)
    return null
  }
}
