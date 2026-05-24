import { z } from 'zod'

import { ErrorCategorySchema } from './errors'
import { MessagePartSchema } from './message-parts'
import { SessionSummarySchema } from './session-summary'

export const MessagePartUpdatedEventSchema = z.object({
  type: z.literal('message.part.updated'),
  properties: z.object({
    part: MessagePartSchema,
    delta: z.string().optional(),
  }),
})
export type MessagePartUpdatedEvent = z.infer<typeof MessagePartUpdatedEventSchema>

export const SessionSummaryUpdatedEventSchema = z.object({
  type: z.literal('session.summary.updated'),
  properties: z.object({
    sessionID: z.string(),
    summary: SessionSummarySchema,
  }),
})
export type SessionSummaryUpdatedEvent = z.infer<typeof SessionSummaryUpdatedEventSchema>

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.string(),
  category: ErrorCategorySchema.optional(),
  retryable: z.boolean().optional(),
  details: z.string().optional(),
})
export type ErrorEvent = z.infer<typeof ErrorEventSchema>

export const DoneEventSchema = z.object({
  type: z.literal('done'),
})
export type DoneEvent = z.infer<typeof DoneEventSchema>

export const PermissionAskedEventSchema = z.object({
  type: z.literal('permission.asked'),
  properties: z.object({
    sessionID: z.string(),
    id: z.string(),
    permission: z.string(),
    patterns: z.array(z.string()).optional(),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
})
export type PermissionAskedEvent = z.infer<typeof PermissionAskedEventSchema>

export const QuestionAskedEventSchema = z.object({
  type: z.literal('question.asked'),
  properties: z.object({
    sessionID: z.string(),
    id: z.string(),
    text: z.string(),
  }),
})
export type QuestionAskedEvent = z.infer<typeof QuestionAskedEventSchema>

export const KeySSEEventSchema = z.discriminatedUnion('type', [
  MessagePartUpdatedEventSchema,
  SessionSummaryUpdatedEventSchema,
  ErrorEventSchema,
  DoneEventSchema,
  PermissionAskedEventSchema,
  QuestionAskedEventSchema,
])
export type KeySSEEvent = z.infer<typeof KeySSEEventSchema>
