/** Model catalog selection and preference contracts. */

import { z } from 'zod'

/** User-level defaults, favorites, and recent selections. */
export const ModelPreferencesSchema = z.object({
  defaultAgentId: z.string(),
  defaultModelByAgent: z.record(z.string()),
  favoriteModelIds: z.array(z.string()).max(20),
  recentModelIds: z.array(z.string()).max(8),
})
export type ModelPreferences = z.infer<typeof ModelPreferencesSchema>

/** Partial preference update accepted by the models API. */
export const UpdateModelPreferencesSchema = ModelPreferencesSchema.partial()
export type UpdateModelPreferences = z.infer<typeof UpdateModelPreferencesSchema>

/** Idle-time selection change for an existing session. */
export const UpdateSessionSelectionRequestSchema = z.object({
  agentId: z.string().min(1),
  modelId: z.string().min(1),
})
export type UpdateSessionSelectionRequest = z.infer<typeof UpdateSessionSelectionRequestSchema>

/** Idempotent command used to accept a new turn. */
export const CreateTurnRequestSchema = z.object({
  content: z.string().trim().min(1).max(100_000),
  mode: z.enum(['agent', 'plan']),
  modelId: z.string().optional(),
  clientCommandId: z.string().uuid(),
})
export type CreateTurnRequest = z.infer<typeof CreateTurnRequestSchema>

/** Immediate result returned after a turn is durably accepted. */
export const TurnAcceptedResponseSchema = z.object({
  sessionId: z.string().uuid(),
  turnId: z.string().uuid(),
  userMessageId: z.string().uuid(),
  acceptedSequence: z.number().int().nonnegative(),
  status: z.enum(['accepted', 'already-accepted']),
})
export type TurnAcceptedResponse = z.infer<typeof TurnAcceptedResponseSchema>
