import { z } from 'zod'

/** Branded session identifier. */
export const SessionIdSchema = z.string().uuid().brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>

/** Branded chat message identifier. */
export const MessageIdSchema = z.string().uuid().brand<'MessageId'>()
export type MessageId = z.infer<typeof MessageIdSchema>

/** Branded agent turn identifier. */
export const TurnIdSchema = z.string().uuid().brand<'TurnId'>()
export type TurnId = z.infer<typeof TurnIdSchema>

/** Branded tool call identifier. */
export const ToolCallIdSchema = z.string().uuid().brand<'ToolCallId'>()
export type ToolCallId = z.infer<typeof ToolCallIdSchema>
