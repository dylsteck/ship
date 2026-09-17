/**
 * Canonical realtime protocol shared by the Worker, SDK, and web application.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { MessageIdSchema, SessionIdSchema, ToolCallIdSchema, TurnIdSchema } from './ids'
import { MessagePartSchema } from './message-parts'
import { TurnSchema } from './turns'

/** Runtime state projected into shell and detail subscriptions. */
export const SessionRuntimeStateSchema = z.enum(['idle', 'starting', 'running', 'stopping', 'failed'])
export type SessionRuntimeState = z.infer<typeof SessionRuntimeStateSchema>

/** Small runtime overlay carried by each session summary. */
export const SessionRuntimeSchema = z.object({
  state: SessionRuntimeStateSchema,
  activeTool: z.string().optional(),
  latestTurnId: TurnIdSchema.optional(),
})
export type SessionRuntime = z.infer<typeof SessionRuntimeSchema>

/** Aggregate Git changes suitable for a session-list row. */
export const ShellDiffStatsSchema = z.object({
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
})
export type ShellDiffStats = z.infer<typeof ShellDiffStatsSchema>

/** Authoritative user-scoped session projection used by the application shell. */
export const ShellSessionSummarySchema = z.object({
  id: SessionIdSchema,
  repoOwner: z.string(),
  repoName: z.string(),
  title: z.string(),
  status: z.string(),
  createdAt: z.number().int(),
  lastActivity: z.number().int(),
  archivedAt: z.number().int().nullable(),
  revision: z.number().int().positive(),
  agentId: z.string(),
  modelId: z.string(),
  runtime: SessionRuntimeSchema,
  diffStats: ShellDiffStatsSchema,
  pullRequestUrl: z.string().url().optional(),
})
export type ShellSessionSummary = z.infer<typeof ShellSessionSummarySchema>

/** Subscribe command for the user shell stream. */
export const ShellSubscribeCommandSchema = z.object({
  type: z.literal('shell.subscribe'),
  afterSequence: z.number().int().nonnegative().optional(),
  requestCompletionMarker: z.literal(true),
})
export type ShellSubscribeCommand = z.infer<typeof ShellSubscribeCommandSchema>

/** One ordered shell projection change. */
export const ShellEventRecordSchema = z.object({
  sequence: z.number().int().positive(),
  occurredAt: z.number().int(),
  event: z.discriminatedUnion('type', [
    z.object({ type: z.literal('session.upserted'), summary: ShellSessionSummarySchema }),
    z.object({ type: z.literal('session.removed'), sessionId: SessionIdSchema }),
  ]),
})
export type ShellEventRecord = z.infer<typeof ShellEventRecordSchema>

/** Server frame for shell snapshots, replay batches, and synchronization state. */
export const ShellStreamFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('shell.snapshot'),
    snapshotSequence: z.number().int().nonnegative(),
    sessions: z.array(ShellSessionSummarySchema),
    reason: z.enum(['initial', 'gap', 'cursor-ahead', 'reconcile']),
    generatedAt: z.number().int(),
  }),
  z.object({ type: z.literal('shell.events'), records: z.array(ShellEventRecordSchema) }),
  z.object({ type: z.literal('shell.synchronized'), sequence: z.number().int().nonnegative() }),
  z.object({
    type: z.literal('shell.error'),
    code: z.string(),
    retryable: z.boolean(),
  }),
  z.object({ type: z.literal('pong'), occurredAt: z.number().int() }),
])
export type ShellStreamFrame = z.infer<typeof ShellStreamFrameSchema>

/** Persisted transcript message returned in snapshots and history pages. */
export const RealtimeMessageSchema = z.object({
  id: MessageIdSchema,
  turnId: z.union([TurnIdSchema, z.string().startsWith('legacy:')]).nullable(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  parts: z.array(MessagePartSchema).optional(),
  createdAt: z.number().int(),
})
export type RealtimeMessage = z.infer<typeof RealtimeMessageSchema>

/** Minimal task/todo representation retained in a detail snapshot. */
export const RealtimeTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'running', 'complete', 'error']),
  mode: z.enum(['build', 'plan']),
  createdAt: z.number().int(),
  completedAt: z.number().int().optional(),
})
export type RealtimeTask = z.infer<typeof RealtimeTaskSchema>

/** Materialized in-progress assistant state included in reconnect snapshots. */
export const LiveTurnStateSchema = z.object({
  turnId: TurnIdSchema,
  messageId: MessageIdSchema,
  text: z.string(),
  parts: z.array(MessagePartSchema),
  updatedAt: z.number().int(),
})
export type LiveTurnState = z.infer<typeof LiveTurnStateSchema>

/** Point-in-time state for one session detail subscription. */
export const SessionDetailSnapshotSchema = z.object({
  sessionId: SessionIdSchema,
  snapshotSequence: z.number().int().nonnegative(),
  summary: ShellSessionSummarySchema,
  turns: z.record(TurnSchema),
  messages: z.record(RealtimeMessageSchema),
  orderedTurnIds: z.array(z.string()),
  orderedMessageIds: z.array(z.string()),
  tasks: z.record(RealtimeTaskSchema),
  liveTurn: LiveTurnStateSchema.optional(),
  beforeCursor: z.string().optional(),
  hasMore: z.boolean(),
})
export type SessionDetailSnapshot = z.infer<typeof SessionDetailSnapshotSchema>

/** One stable older-turn page returned by the transcript REST endpoint. */
export const TranscriptPageSchema = z.object({
  turns: z.array(TurnSchema),
  messages: z.array(RealtimeMessageSchema),
  beforeCursor: z.string().optional(),
  hasMore: z.boolean(),
  snapshotSequence: z.number().int().nonnegative(),
})
export type TranscriptPage = z.infer<typeof TranscriptPageSchema>

/** Subscribe command for one session detail stream. */
export const SessionSubscribeCommandSchema = z.object({
  type: z.literal('session.subscribe'),
  afterSequence: z.number().int().nonnegative().optional(),
  requestCompletionMarker: z.literal(true),
  turnLimit: z.number().int().min(1).max(50).optional(),
})
export type SessionSubscribeCommand = z.infer<typeof SessionSubscribeCommandSchema>

const TurnLifecyclePropertiesSchema = z.object({
  sessionId: SessionIdSchema,
  turnId: TurnIdSchema,
  status: z.string().optional(),
  occurredAt: z.number().int().optional(),
})

/** Canonical event payload stored in the session event log. */
export const SessionRealtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('turn.started'), properties: TurnLifecyclePropertiesSchema }),
  z.object({ type: z.literal('turn.completed'), properties: TurnLifecyclePropertiesSchema }),
  z.object({ type: z.literal('turn.failed'), properties: TurnLifecyclePropertiesSchema.extend({ error: z.string().optional() }) }),
  z.object({ type: z.literal('turn.interrupted'), properties: TurnLifecyclePropertiesSchema.extend({ error: z.string().optional() }) }),
  z.object({ type: z.literal('message.created'), properties: z.object({ message: RealtimeMessageSchema }) }),
  z.object({
    type: z.literal('message.part.updated'),
    properties: z.object({ part: MessagePartSchema, delta: z.string().optional() }),
  }),
  z.object({
    type: z.literal('message.completed'),
    properties: z.object({ messageId: MessageIdSchema, turnId: TurnIdSchema.nullable() }),
  }),
  z.object({
    type: z.literal('session.runtime.updated'),
    properties: z.object({ sessionId: SessionIdSchema, runtime: SessionRuntimeSchema }),
  }),
  z.object({
    type: z.literal('session.diff'),
    properties: z.object({ turnId: TurnIdSchema.optional(), diff: z.array(z.object({ filename: z.string(), additions: z.number(), deletions: z.number() })) }),
  }),
  z.object({ type: z.literal('todo.updated'), properties: z.object({ todos: z.array(RealtimeTaskSchema) }) }),
  z.object({
    type: z.literal('permission.asked'),
    properties: z.object({ sessionID: z.string(), id: z.string(), permission: z.string(), patterns: z.array(z.string()).optional(), description: z.string().optional(), metadata: z.record(z.unknown()).optional() }),
  }),
  z.object({ type: z.literal('permission.granted'), properties: z.record(z.unknown()) }),
  z.object({ type: z.literal('permission.denied'), properties: z.record(z.unknown()) }),
  z.object({ type: z.literal('question.asked'), properties: z.object({ sessionID: z.string(), id: z.string(), text: z.string() }) }),
  z.object({ type: z.literal('question.replied'), properties: z.record(z.unknown()) }),
  z.object({ type: z.literal('question.rejected'), properties: z.record(z.unknown()) }),
  z.object({
    type: z.literal('session.error'),
    properties: z.object({ sessionID: z.string(), error: z.unknown(), retryable: z.boolean().optional() }),
  }),
  z.object({ type: z.literal('status'), status: z.string(), message: z.string().optional() }),
])
export type SessionRealtimeEvent = z.infer<typeof SessionRealtimeEventSchema>

/** One persisted and replayable event in a session-local sequence. */
export const SessionEventRecordSchema = z.object({
  eventId: z.string().min(1),
  sequence: z.number().int().positive(),
  turnId: TurnIdSchema.nullable().optional(),
  occurredAt: z.number().int(),
  event: SessionRealtimeEventSchema,
})
export type SessionEventRecord = z.infer<typeof SessionEventRecordSchema>

/** Server frame for detail snapshots, replay batches, and synchronization state. */
export const SessionStreamFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('session.snapshot'),
    snapshot: SessionDetailSnapshotSchema,
    reason: z.enum(['initial', 'gap', 'cursor-ahead', 'compacted']),
  }),
  z.object({ type: z.literal('session.events'), records: z.array(SessionEventRecordSchema) }),
  z.object({ type: z.literal('session.synchronized'), sequence: z.number().int().nonnegative() }),
  z.object({ type: z.literal('session.error'), code: z.string(), retryable: z.boolean() }),
  z.object({ type: z.literal('pong'), occurredAt: z.number().int() }),
])
export type SessionStreamFrame = z.infer<typeof SessionStreamFrameSchema>

/** Scoped one-use websocket ticket request. */
export const RealtimeTicketRequestSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('shell') }),
  z.object({ scope: z.literal('session'), sessionId: SessionIdSchema }),
])
export type RealtimeTicketRequest = z.infer<typeof RealtimeTicketRequestSchema>

/** Realtime ticket response consumed immediately before websocket connect. */
export const RealtimeTicketResponseSchema = z.object({
  ticket: z.string(),
  expiresAt: z.number().int(),
})
export type RealtimeTicketResponse = z.infer<typeof RealtimeTicketResponseSchema>

/** Producer event before the SessionDO assigns its canonical sequence. */
export const SessionProducerEventSchema = z.object({
  eventId: z.string().min(1),
  turnId: TurnIdSchema.optional(),
  occurredAt: z.number().int(),
  event: SessionRealtimeEventSchema,
})
export type SessionProducerEvent = z.infer<typeof SessionProducerEventSchema>

/** Ordered producer batch accepted only by an internal SessionDO socket. */
export const SessionProducerBatchSchema = z.object({
  type: z.literal('producer.batch'),
  batchId: z.string().min(1),
  records: z.array(SessionProducerEventSchema).min(1).max(32),
})
export type SessionProducerBatch = z.infer<typeof SessionProducerBatchSchema>

/** Acknowledgement for an idempotently accepted producer batch. */
export const SessionProducerAckSchema = z.object({
  type: z.literal('producer.ack'),
  batchId: z.string(),
  records: z.array(z.object({ eventId: z.string(), sequence: z.number().int().positive() })),
})
export type SessionProducerAck = z.infer<typeof SessionProducerAckSchema>

/** Lazy tool-output payload returned outside snapshots. */
export const ToolOutputResponseSchema = z.object({
  toolCallId: ToolCallIdSchema.or(z.string()),
  output: z.string(),
})
export type ToolOutputResponse = z.infer<typeof ToolOutputResponseSchema>
