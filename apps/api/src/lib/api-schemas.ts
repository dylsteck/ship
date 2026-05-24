/**
 * Zod schemas for JSON request bodies on the Ship API Worker.
 *
 * @remarks
 * Re-exports from `openapi/schemas.ts` (single source for validation + OpenAPI).
 * Authorization is enforced separately in `session-authorization.ts`.
 */

export {
  chatPostBodySchema,
  createSessionBodySchema,
  sandboxProvisionBodySchema,
  uuidParamSchema,
} from '../openapi/schemas'

import type { Context } from 'hono'
import type { z } from 'zod'

/**
 * Parse `c.req.json()` with a Zod schema. On failure, returns a JSON {@link Response} (400).
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
