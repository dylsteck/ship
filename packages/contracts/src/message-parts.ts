import { z } from 'zod'

export const ToolStateStatusSchema = z.enum(['pending', 'running', 'completed', 'error'])

export const ToolStateSchema = z.object({
  status: ToolStateStatusSchema,
  input: z.record(z.unknown()),
  raw: z.string().optional(),
  title: z.string().optional(),
  output: z.string().optional(),
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

export const MessagePartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  ToolPartSchema,
  ReasoningPartSchema,
  StepFinishPartSchema,
])
export type MessagePart = z.infer<typeof MessagePartSchema>
