/** Model preference endpoints used by the searchable picker. */

import { Hono } from 'hono'
import { UpdateModelPreferencesSchema } from '@ship/contracts'

import { parseJsonBody } from '../lib/api-schemas'
import { readModelPreferences, updateModelPreferences } from '../lib/model-preferences'
import { requireJwtUserId, type AuthedEnv } from '../lib/session-authorization'

const modelPreferences = new Hono<AuthedEnv>()

/** Return defaults, favorites, and recent model ids. */
modelPreferences.get('/preferences', async (c) => {
  const userId = requireJwtUserId(c)
  if (typeof userId !== 'string') return userId
  return c.json(await readModelPreferences(c.env, userId))
})

/** Merge a bounded model-preference patch. */
modelPreferences.patch('/preferences', async (c) => {
  const userId = requireJwtUserId(c)
  if (typeof userId !== 'string') return userId
  const patch = await parseJsonBody(c, UpdateModelPreferencesSchema)
  if (patch instanceof Response) return patch
  return c.json(await updateModelPreferences(c.env, userId, patch))
})

export default modelPreferences
