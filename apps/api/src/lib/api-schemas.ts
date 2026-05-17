/**
 * Zod schemas for JSON request bodies on the Ship API Worker.
 *
 * @remarks
 * These validate **shape and bounds** only. Authorization (JWT user id, session ownership)
 * is enforced separately in `session-authorization.ts`.
 */

import { z } from 'zod'
import type { Context } from 'hono'

/** UUID path/query parameter (session id, etc.). */
export const uuidParamSchema = z.string().uuid()

export const chatPostBodySchema = z.object({
  content: z.string().max(100_000),
  mode: z.string().max(64).optional(),
})

export const createSessionBodySchema = z.object({
  repoOwner: z.string().min(1).max(200),
  repoName: z.string().min(1).max(200),
  model: z.string().max(200).optional(),
  agentType: z.string().max(64).optional(),
  title: z.string().max(500).optional(),
  baseBranch: z.string().max(256).optional(),
})

export const sandboxProvisionBodySchema = z.object({
  sessionId: uuidParamSchema,
})

const bankrMessageSchema = z.object({
  role: z.string().min(1).max(32),
  content: z.string(),
})

export const bankrChatBodySchema = z.object({
  model: z.string().min(1).max(200),
  messages: z.array(bankrMessageSchema).min(1).max(500),
  stream: z.boolean().optional(),
  max_tokens: z.number().int().positive().max(1_000_000).optional(),
})

export const bankrMessagesBodySchema = z.object({
  model: z.string().min(1).max(200),
  messages: z.array(bankrMessageSchema).min(1).max(500),
  system: z.string().max(500_000).optional(),
  stream: z.boolean().optional(),
  max_tokens: z.number().int().positive().max(1_000_000).optional(),
})

/**
 * Parse `c.req.json()` with a Zod schema. On failure, returns a JSON {@link Response} (400).
 *
 * @typeParam T - Inferred output type of `schema`
 * @returns Parsed value, or an error response to return from the route handler
 */
export async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>): Promise<T | Response> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.flatten() }, 400)
  }
  return result.data
}
