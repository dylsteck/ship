/**
 * Event Translator: sandbox-agent SessionEvent → Ship SSE Events
 *
 * Maps sandbox-agent's UniversalEvent schema to Ship's existing SSE event
 * format so the frontend stays mostly unchanged. The translation layer
 * generates synthetic part IDs matching OpenCode's format.
 *
 * UniversalEvent types:
 *   session.started, session.ended, turn.started, turn.ended,
 *   item.started, item.delta, item.completed,
 *   permission.requested, permission.resolved,
 *   question.requested, question.resolved,
 *   error, agent.unparsed
 *
 * Ship SSE event types:
 *   status, message.part.updated, session.idle, session.error,
 *   permission.asked, permission.granted, permission.denied,
 *   question.asked, question.replied, question.rejected,
 *   todo.updated, done
 */

import type { SessionEvent } from 'sandbox-agent'

// ============ Ship SSE Event Types ============

export interface ShipSSEEvent {
  type: string
  [key: string]: unknown
}

// ============ Translator State ============

/**
 * Tracks state across a stream of events for a single session.
 * Accumulates text deltas, maps tool calls, generates synthetic IDs.
 */
export class EventTranslatorState {
  readonly shipSessionId: string
  currentMessageId: string | null = null
  textAccumulator = ''
  reasoningAccumulator = ''
  toolCallMap: Map<string, { tool: string; state: string; input: string; output: string }> = new Map()
  private partCounter = 0
  private hasChanges = false

  constructor(shipSessionId: string) {
    this.shipSessionId = shipSessionId
  }

  private nextPartId(): string {
    return `part-${this.shipSessionId.slice(0, 8)}-${++this.partCounter}`
  }

  private ensureMessageId(): string {
    if (!this.currentMessageId) {
      this.currentMessageId = `msg-${this.shipSessionId.slice(0, 8)}-${Date.now()}`
    }
    return this.currentMessageId
  }

  get hasFileChanges(): boolean {
    return this.hasChanges
  }

  get accumulatedText(): string {
    return this.textAccumulator
  }

  /**
   * Build parts array for message persistence (reasoning, tools, text).
   * Used when saving assistant message so reload shows thinking and tool calls.
   */
  getAccumulatedParts(): string {
    const messageId = this.ensureMessageId()
    const parts: Array<Record<string, unknown>> = []

    if (this.reasoningAccumulator) {
      parts.push({
        id: `part-r-${this.shipSessionId.slice(0, 8)}`,
        sessionID: this.shipSessionId,
        messageID: messageId,
        type: 'reasoning',
        text: this.reasoningAccumulator,
      })
    }

    for (const [callId, toolState] of this.toolCallMap) {
      const input = this.safeParseJson(toolState.input) as Record<string, unknown>
      parts.push({
        id: `part-t-${callId}`,
        sessionID: this.shipSessionId,
        messageID: messageId,
        type: 'tool',
        callID: callId,
        tool: toolState.tool,
        state: {
          status: toolState.state === 'failed' ? 'error' : toolState.state,
          input,
          output: toolState.output || undefined,
          title: toolState.tool,
        },
      })
    }

    if (this.textAccumulator) {
      parts.push({
        id: `part-txt-${this.shipSessionId.slice(0, 8)}`,
        sessionID: this.shipSessionId,
        messageID: messageId,
        type: 'text',
        text: this.textAccumulator,
      })
    }

    return JSON.stringify(parts)
  }

  /**
   * Main translation function.
   * Takes a sandbox-agent SessionEvent and returns zero or more Ship SSE events.
   * Handles ACP protocol (session/update, session/prompt, JSON-RPC responses)
   * and falls back to UniversalEvent format for future compatibility.
   */
  translateEvent(event: SessionEvent): ShipSSEEvent[] {
    const payload = event.payload as Record<string, unknown>
    const method = payload.method as string | undefined
    const params = payload.params as Record<string, unknown> | undefined

    // Skip client-sent events (e.g. session/prompt request echo)
    if ((event as { sender?: string }).sender === 'client') {
      return []
    }

    // Handle JSON-RPC response (prompt completion) — no method, has result
    if (!method && payload.result !== undefined) {
      return [
        {
          type: 'session.idle',
          properties: { sessionID: this.shipSessionId },
        },
        { type: 'done' },
      ]
    }

    // Route by ACP method
    if (method === 'session/update' && params?.update) {
      return this.handleAcpSessionUpdate(params.update as Record<string, unknown>)
    }

    if (method === 'session/prompt') {
      // Request echo from client — skip
      return []
    }

    // Fall back to UniversalEvent handling for future compatibility
    if (method && params) {
      const universalEvent = (params.event as Record<string, unknown>) || params
      const eventType = (universalEvent.type as string) || method

      switch (eventType) {
        case 'session.started':
          return this.handleSessionStarted()
        case 'session.ended':
          return this.handleSessionEnded(universalEvent)
        case 'turn.started':
          return this.handleTurnStarted()
        case 'turn.ended':
          return this.handleTurnEnded()
        case 'item.started':
          return this.handleItemStarted(universalEvent)
        case 'item.delta':
          return this.handleItemDelta(universalEvent)
        case 'item.completed':
          return this.handleItemCompleted(universalEvent)
        case 'permission.requested':
          return this.handlePermissionRequested(universalEvent)
        case 'permission.resolved':
          return this.handlePermissionResolved(universalEvent)
        case 'question.requested':
          return this.handleQuestionRequested(universalEvent)
        case 'question.resolved':
          return this.handleQuestionResolved(universalEvent)
        case 'error':
          return this.handleError(universalEvent)
      }
    }

    return []
  }

  /**
   * Handle ACP session/update — params.update is SessionUpdate (discriminated union).
   */
  private handleAcpSessionUpdate(update: Record<string, unknown>): ShipSSEEvent[] {
    const sessionUpdate = update.sessionUpdate as string | undefined

    switch (sessionUpdate) {
      case 'agent_message_chunk':
        return this.handleAcpContentChunk(update, 'text')
      case 'agent_thought_chunk':
        return this.handleAcpContentChunk(update, 'reasoning')
      case 'user_message_chunk':
        return [] // Skip user input echo
      case 'tool_call':
        return this.handleAcpToolCall(update)
      case 'tool_call_update':
        return this.handleAcpToolCallUpdate(update)
      case 'plan':
        return this.handleAcpPlan(update)
      case 'available_commands_update':
      case 'current_mode_update':
      case 'config_option_update':
        return []
      case 'session_info_update':
        return this.handleAcpSessionInfoUpdate(update)
      case 'usage_update':
        return []
      default:
        return []
    }
  }

  /**
   * Handle ACP session_info_update — emit session.updated with title.
   * Agents send this to update session metadata (e.g. auto-generated title).
   */
  private handleAcpSessionInfoUpdate(update: Record<string, unknown>): ShipSSEEvent[] {
    const title = (update.title as string | undefined) ?? (update.info as Record<string, unknown>)?.title as string | undefined
    if (!title?.trim()) return []

    console.log(`[event-translator] Agent sent session_info_update title: "${title.slice(0, 40)}${title.length > 40 ? '...' : ''}"`)
    const now = Math.floor(Date.now() / 1000)
    return [
      {
        type: 'session.updated',
        properties: {
          info: {
            id: this.shipSessionId,
            slug: '',
            version: '',
            projectID: '',
            directory: '',
            title: title.trim(),
            time: { created: now, updated: now },
            summary: { additions: 0, deletions: 0, files: 0 },
          },
        },
      },
    ]
  }

  /**
   * Extract text from ACP ContentChunk and emit message.part.updated.
   * Content can be single object or array: { type: "text", text: string, annotations?: {...} }
   */
  private handleAcpContentChunk(
    chunk: Record<string, unknown>,
    partType: 'text' | 'reasoning',
  ): ShipSSEEvent[] {
    const content = chunk.content
    if (!content) return []

    const blocks = Array.isArray(content) ? content : [content]
    const events: ShipSSEEvent[] = []

    for (const block of blocks) {
      const b = block as Record<string, unknown>
      if (b.type !== 'text') continue

      const text = b.text as string | undefined
      if (!text) continue

      // Check for error annotation
      const annotations = b.annotations as Record<string, unknown> | undefined
      const meta = annotations?._meta as Record<string, unknown> | undefined
      if (meta?.isError === true) {
        events.push({
          type: 'session.error',
          properties: {
            sessionID: this.shipSessionId,
            error: {
              name: 'AgentError',
              data: { message: text },
            },
          },
        })
        return events
      }

      if (partType === 'text') {
        this.textAccumulator += text
        events.push(this.makeTextPart(this.textAccumulator, text))
      } else {
        this.reasoningAccumulator += text
        events.push(this.makeReasoningPart(this.reasoningAccumulator, text))
      }
    }

    return events
  }

  private makeTextPart(fullText: string, delta?: string): ShipSSEEvent {
    const messageId = this.ensureMessageId()
    const part: Record<string, unknown> = {
      id: this.nextPartId(),
      sessionID: this.shipSessionId,
      messageID: messageId,
      type: 'text',
      text: fullText,
    }
    return {
      type: 'message.part.updated',
      properties: { part, ...(delta !== undefined ? { delta } : {}) },
    }
  }

  private makeReasoningPart(fullText: string, delta?: string): ShipSSEEvent {
    const messageId = this.ensureMessageId()
    return {
      type: 'message.part.updated',
      properties: {
        part: {
          id: this.nextPartId(),
          sessionID: this.shipSessionId,
          messageID: messageId,
          type: 'reasoning',
          text: fullText,
        },
        ...(delta !== undefined ? { delta } : {}),
      },
    }
  }

  /**
   * Handle ACP tool_call — ToolCall with sessionUpdate: "tool_call"
   * ACP may use toolCallId or id for the call identifier
   */
  private handleAcpToolCall(update: Record<string, unknown>): ShipSSEEvent[] {
    const toolName = (update.toolName ?? update.title) as string | undefined
    const id = ((update.toolCallId ?? update.id) as string) || this.nextPartId()
    const status = (update.status as string) || 'pending'
    const rawIn = update.input ?? update.rawInput
    const input: Record<string, unknown> =
      typeof rawIn === 'object' && rawIn !== null
        ? (rawIn as Record<string, unknown>)
        : typeof rawIn === 'string'
          ? this.safeParseJson(rawIn)
          : {}

    if (!toolName) return []

    this.toolCallMap.set(id, {
      tool: toolName,
      state: status,
      input: JSON.stringify(input),
      output: '',
    })

    const messageId = this.ensureMessageId()
    return [{
      type: 'message.part.updated',
      properties: {
        part: {
          id: this.nextPartId(),
          sessionID: this.shipSessionId,
          messageID: messageId,
          type: 'tool',
          callID: id,
          tool: toolName,
          state: {
            status: status === 'failed' ? 'error' : (status as 'pending' | 'running' | 'completed'),
            input,
            title: toolName,
            time: { start: Date.now() },
          },
        },
      },
    }]
  }

  /**
   * Handle ACP tool_call_update — ToolCallUpdate with status/input/output changes
   * ACP uses toolCallId; accept callId as fallback for compatibility
   */
  private handleAcpToolCallUpdate(update: Record<string, unknown>): ShipSSEEvent[] {
    const callId = (update.toolCallId ?? update.callId) as string | undefined
    if (!callId) return []

    const toolState = this.toolCallMap.get(callId)
    const toolName = (update.toolName ?? update.title) as string || toolState?.tool || 'unknown'
    const status = (update.status as string) || toolState?.state || 'running'
    const input = (update.input ?? update.rawInput) as Record<string, unknown> | undefined
    const rawOut = update.output ?? update.rawOutput
    const output = typeof rawOut === 'string' ? rawOut : (rawOut != null ? JSON.stringify(rawOut) : undefined)

    if (input) {
      const existing = this.toolCallMap.get(callId)
      if (existing) {
        existing.input = JSON.stringify(input)
      } else {
        this.toolCallMap.set(callId, {
          tool: toolName,
          state: status,
          input: JSON.stringify(input || {}),
          output: output || '',
        })
      }
    }
    if (output !== undefined) {
      const existing = this.toolCallMap.get(callId)
      if (existing) existing.output = output
    }
    const existing = this.toolCallMap.get(callId)
    const finalState = existing || {
      tool: toolName,
      state: status,
      input: JSON.stringify(input || {}),
      output: output || '',
    }
    this.toolCallMap.set(callId, { ...finalState, state: status })

    const messageId = this.ensureMessageId()
    const sseStatus = status === 'failed' ? 'error' : (status as 'pending' | 'running' | 'completed')
    return [{
      type: 'message.part.updated',
      properties: {
        part: {
          id: this.nextPartId(),
          sessionID: this.shipSessionId,
          messageID: messageId,
          type: 'tool',
          callID: callId,
          tool: toolName,
          state: {
            status: sseStatus,
            input: input ?? this.safeParseJson(finalState.input),
            output: output ?? finalState.output,
            title: toolName,
            time: { start: Date.now(), ...(sseStatus === 'completed' || sseStatus === 'error' ? { end: Date.now() } : {}) },
          },
        },
      },
    }]
  }

  /**
   * Handle ACP plan update — map to status or text event
   */
  private handleAcpPlan(_update: Record<string, unknown>): ShipSSEEvent[] {
    // Plan updates are metadata; could emit status if needed
    return []
  }

  // ============ Session Lifecycle ============

  private handleSessionStarted(): ShipSSEEvent[] {
    return [{
      type: 'status',
      status: 'agent-active',
      message: 'Agent is processing your request...',
    }]
  }

  private handleSessionEnded(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    const reason = data?.reason as string | undefined

    if (reason === 'error') {
      const message = (data?.message as string) || 'Agent session ended with error'
      return [{
        type: 'session.error',
        properties: {
          sessionID: this.shipSessionId,
          error: { name: 'SessionError', data: { message } },
        },
      }]
    }

    return [
      {
        type: 'session.idle',
        properties: { sessionID: this.shipSessionId },
      },
      { type: 'done' },
    ]
  }

  // ============ Turn Lifecycle ============

  private handleTurnStarted(): ShipSSEEvent[] {
    // Reset accumulators for new turn
    this.currentMessageId = null
    this.textAccumulator = ''
    this.reasoningAccumulator = ''
    this.toolCallMap.clear()
    this.partCounter = 0

    return [{
      type: 'status',
      status: 'sending-prompt',
      message: 'Agent is thinking...',
    }]
  }

  private handleTurnEnded(): ShipSSEEvent[] {
    return [{
      type: 'session.idle',
      properties: { sessionID: this.shipSessionId },
    }]
  }

  // ============ Item Lifecycle ============

  private handleItemStarted(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    const item = data?.item as Record<string, unknown> | undefined
    if (!item) return []

    const kind = item.kind as string
    const content = item.content as Array<Record<string, unknown>> | undefined

    if (kind === 'message' || kind === 'system') {
      // Start tracking a new assistant message
      this.ensureMessageId()
      return []
    }

    if (kind === 'tool_call') {
      const messageId = this.ensureMessageId()
      const itemId = item.item_id as string
      const toolCall = content?.find((c) => c.type === 'tool_call')
      const toolName = (toolCall?.name as string) || 'unknown'
      const callId = (toolCall?.call_id as string) || itemId

      this.toolCallMap.set(itemId, {
        tool: toolName,
        state: 'pending',
        input: (toolCall?.arguments as string) || '{}',
        output: '',
      })

      return [{
        type: 'message.part.updated',
        properties: {
          part: {
            id: this.nextPartId(),
            sessionID: this.shipSessionId,
            messageID: messageId,
            type: 'tool',
            callID: callId,
            tool: toolName,
            state: {
              status: 'pending',
              input: this.safeParseJson(toolCall?.arguments as string),
              title: toolName,
              time: { start: Date.now() },
            },
          },
        },
      }]
    }

    return []
  }

  private handleItemDelta(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    if (!data) return []

    const delta = data.delta as string | undefined
    const itemId = data.item_id as string | undefined

    if (!delta) return []

    const messageId = this.ensureMessageId()

    // Check if this delta is for a tool call
    if (itemId && this.toolCallMap.has(itemId)) {
      const toolState = this.toolCallMap.get(itemId)!
      toolState.state = 'running'
      toolState.output += delta

      return [{
        type: 'message.part.updated',
        properties: {
          part: {
            id: this.nextPartId(),
            sessionID: this.shipSessionId,
            messageID: messageId,
            type: 'tool',
            callID: itemId,
            tool: toolState.tool,
            state: {
              status: 'running',
              input: this.safeParseJson(toolState.input),
              raw: toolState.output,
              title: toolState.tool,
            },
          },
        },
      }]
    }

    // Check content type from the item context
    // Deltas for text content
    this.textAccumulator += delta

    return [{
      type: 'message.part.updated',
      properties: {
        part: {
          id: this.nextPartId(),
          sessionID: this.shipSessionId,
          messageID: messageId,
          type: 'text',
          text: this.textAccumulator,
        },
        delta,
      },
    }]
  }

  private handleItemCompleted(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    const item = data?.item as Record<string, unknown> | undefined
    if (!item) return []

    const kind = item.kind as string
    const itemId = item.item_id as string
    const content = item.content as Array<Record<string, unknown>> | undefined
    const status = item.status as string
    const messageId = this.ensureMessageId()
    const events: ShipSSEEvent[] = []

    if (kind === 'tool_call') {
      const toolState = this.toolCallMap.get(itemId)
      const toolCall = content?.find((c) => c.type === 'tool_call')
      const toolName = toolState?.tool || (toolCall?.name as string) || 'unknown'
      const callId = (toolCall?.call_id as string) || itemId
      const isError = status === 'failed'

      events.push({
        type: 'message.part.updated',
        properties: {
          part: {
            id: this.nextPartId(),
            sessionID: this.shipSessionId,
            messageID: messageId,
            type: 'tool',
            callID: callId,
            tool: toolName,
            state: {
              status: isError ? 'error' : 'completed',
              input: this.safeParseJson(toolCall?.arguments as string || toolState?.input || '{}'),
              output: toolState?.output || '',
              title: toolName,
              time: { start: Date.now(), end: Date.now() },
            },
          },
        },
      })

      // Track file changes for git workflow
      if (toolName.includes('write') || toolName.includes('edit') || toolName.includes('create') || toolName.includes('patch')) {
        this.hasChanges = true
      }
    }

    if (kind === 'tool_result') {
      const parentId = item.parent_id as string | undefined
      const toolResult = content?.find((c) => c.type === 'tool_result')
      const output = (toolResult?.output as string) || ''

      if (parentId && this.toolCallMap.has(parentId)) {
        const toolState = this.toolCallMap.get(parentId)!
        toolState.output = output
        toolState.state = 'completed'

        events.push({
          type: 'message.part.updated',
          properties: {
            part: {
              id: this.nextPartId(),
              sessionID: this.shipSessionId,
              messageID: messageId,
              type: 'tool',
              callID: parentId,
              tool: toolState.tool,
              state: {
                status: 'completed',
                input: this.safeParseJson(toolState.input),
                output,
                title: toolState.tool,
                time: { start: Date.now(), end: Date.now() },
              },
            },
          },
        })
      }
    }

    if (kind === 'message') {
      // Process any content parts we haven't seen
      if (content) {
        for (const part of content) {
          if (part.type === 'text') {
            const text = part.text as string
            if (text && text !== this.textAccumulator) {
              this.textAccumulator = text
              events.push({
                type: 'message.part.updated',
                properties: {
                  part: {
                    id: this.nextPartId(),
                    sessionID: this.shipSessionId,
                    messageID: messageId,
                    type: 'text',
                    text,
                  },
                },
              })
            }
          }

          if (part.type === 'reasoning') {
            const text = part.text as string
            if (text) {
              this.reasoningAccumulator = text
              events.push({
                type: 'message.part.updated',
                properties: {
                  part: {
                    id: this.nextPartId(),
                    sessionID: this.shipSessionId,
                    messageID: messageId,
                    type: 'reasoning',
                    text,
                  },
                },
              })
            }
          }

          if (part.type === 'file_ref') {
            const action = part.action as string
            if (action === 'write' || action === 'patch') {
              this.hasChanges = true
            }
          }
        }
      }
    }

    return events
  }

  // ============ Permission Flow ============

  private handlePermissionRequested(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    return [{
      type: 'permission.asked',
      properties: {
        sessionID: this.shipSessionId,
        id: data?.permission_id as string,
        permission: data?.action as string || 'unknown',
        metadata: data?.metadata as Record<string, unknown> | undefined,
      },
    }]
  }

  private handlePermissionResolved(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    const status = data?.status as string

    if (status === 'reject') {
      return [{
        type: 'permission.denied',
        properties: {
          sessionID: this.shipSessionId,
          id: data?.permission_id as string,
          permission: data?.action as string || 'unknown',
        },
      }]
    }

    return [{
      type: 'permission.granted',
      properties: {
        sessionID: this.shipSessionId,
        id: data?.permission_id as string,
        permission: data?.action as string || 'unknown',
      },
    }]
  }

  // ============ Question Flow ============

  private handleQuestionRequested(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    return [{
      type: 'question.asked',
      properties: {
        sessionID: this.shipSessionId,
        id: data?.question_id as string,
        text: data?.prompt as string || '',
      },
    }]
  }

  private handleQuestionResolved(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    const status = data?.status as string

    if (status === 'rejected') {
      return [{
        type: 'question.rejected',
        properties: {
          sessionID: this.shipSessionId,
          id: data?.question_id as string,
        },
      }]
    }

    return [{
      type: 'question.replied',
      properties: {
        sessionID: this.shipSessionId,
        id: data?.question_id as string,
        text: data?.response as string || '',
      },
    }]
  }

  // ============ Error ============

  private handleError(event: Record<string, unknown>): ShipSSEEvent[] {
    const data = event.data as Record<string, unknown> | undefined
    return [{
      type: 'session.error',
      properties: {
        sessionID: this.shipSessionId,
        error: {
          name: 'AgentError',
          data: { message: (data?.message as string) || 'Unknown agent error' },
        },
      },
    }]
  }

  // ============ Helpers ============

  private safeParseJson(str: string | undefined | null): Record<string, unknown> {
    if (!str) return {}
    try {
      return JSON.parse(str) as Record<string, unknown>
    } catch {
      return { raw: str }
    }
  }
}
