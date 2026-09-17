import { z } from 'zod'

export const ToolStateStatusSchema = z.enum(['pending', 'running', 'completed', 'error'])

export const ToolStateSchema = z.object({
  status: ToolStateStatusSchema,
  input: z.record(z.unknown()),
  raw: z.string().optional(),
  title: z.string().optional(),
  output: z.string().optional(),
  outputPreview: z.string().optional(),
  outputTruncated: z.boolean().optional(),
  detailRef: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  time: z
    .object({
      start: z.number(),
      end: z.number().optional(),
    })
    .optional(),
})
export type ToolState = z.infer<typeof ToolStateSchema>

export const TextPartSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
  type: z.literal('text'),
  text: z.string(),
  time: z
    .object({
      start: z.number(),
      end: z.number().optional(),
    })
    .optional(),
})
export type TextPart = z.infer<typeof TextPartSchema>

export const ToolPartSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
  type: z.literal('tool'),
  callID: z.string(),
  tool: z.string(),
  state: ToolStateSchema,
  displayLabel: z.string().optional(),
  activityKind: z.string().optional(),
  collapseKey: z.string().optional(),
})
export type ToolPart = z.infer<typeof ToolPartSchema>

export const ReasoningPartSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
  type: z.literal('reasoning'),
  text: z.string(),
})
export type ReasoningPart = z.infer<typeof ReasoningPartSchema>

export const StepFinishPartSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
  type: z.literal('step-finish'),
  reason: z.enum(['stop', 'tool-calls', 'unknown']),
  snapshot: z.string(),
  cost: z.number(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache: z.object({
      read: z.number(),
      write: z.number(),
    }),
  }),
})
export type StepFinishPart = z.infer<typeof StepFinishPartSchema>

/** Marker emitted when an agent begins a logical work step. */
export const StepStartPartSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
  type: z.literal('step-start'),
  title: z.string().optional(),
})
export type StepStartPart = z.infer<typeof StepStartPartSchema>

/** One durable step in an agent-authored plan. */
export const PlanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
})
export type PlanItem = z.infer<typeof PlanItemSchema>

/** Materialized plan part shared by live events and persisted transcript rows. */
export const PlanPartSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
  type: z.literal('plan'),
  items: z.array(PlanItemSchema),
})
export type PlanPart = z.infer<typeof PlanPartSchema>

export const MessagePartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  ToolPartSchema,
  ReasoningPartSchema,
  StepStartPartSchema,
  StepFinishPartSchema,
  PlanPartSchema,
])
export type MessagePart = z.infer<typeof MessagePartSchema>
