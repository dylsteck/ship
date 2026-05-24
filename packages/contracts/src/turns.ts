import { z } from 'zod'

import { TurnIdSchema } from './ids'

/** Lifecycle status for a single chat turn. */
export const TurnStatusSchema = z.enum(['running', 'completed', 'failed', 'interrupted', 'cancelled'])
export type TurnStatus = z.infer<typeof TurnStatusSchema>

/** Per-file diff stats for a completed turn. */
export const TurnDiffSummarySchema = z.object({
  filename: z.string(),
  additions: z.number(),
  deletions: z.number(),
})
export type TurnDiffSummary = z.infer<typeof TurnDiffSummarySchema>

/** Turn record projected for thread detail and diff endpoints. */
export const TurnSchema = z.object({
  id: TurnIdSchema,
  sessionID: z.string(),
  status: TurnStatusSchema,
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  cost: z.number().optional(),
  diffSummary: z.array(TurnDiffSummarySchema).optional(),
})
export type Turn = z.infer<typeof TurnSchema>
