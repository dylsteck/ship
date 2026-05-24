import { z } from 'zod'

/** Diff stats attached to a session row in the shell stream. */
export const SessionDiffStatsSchema = z.object({
  additions: z.number(),
  deletions: z.number(),
  files: z.number(),
})
export type SessionDiffStats = z.infer<typeof SessionDiffStatsSchema>

/**
 * Session summary payload for sidebar / shell stream consumers.
 *
 * Field names align with {@link SessionInfo} in `apps/web/lib/sse-types.ts`.
 */
export const SessionSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  version: z.string(),
  projectID: z.string(),
  directory: z.string(),
  title: z.string(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
  summary: SessionDiffStatsSchema,
  share: z
    .object({
      url: z.string(),
    })
    .optional(),
  agentType: z.string().optional(),
  streaming: z.boolean().optional(),
  activeTool: z.string().optional(),
  latestTurnId: z.string().optional(),
})
export type SessionSummary = z.infer<typeof SessionSummarySchema>
