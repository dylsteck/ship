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
   * Main translation function.
   * Takes a sandbox-agent SessionEvent and returns zero or more Ship SSE events.
   */
  translateEvent(event: SessionEvent): ShipSSEEvent[] {
    // The event.payload contains the ACP message with the UniversalEvent data
    // SessionEvent structure: { id, eventIndex, sessionId, createdAt, connectionId, sender, payload }
    const payload = event.payload as Record<string, unknown>

    // ACP notifications come as JSON-RPC with method + params
    const method = payload.method as string | undefined
    const params = payload.params as Record<string, unknown> | undefined

    if (!method || !params) {
      // Could be a response or other non-notification message
      return []
    }

    // The params contain the UniversalEvent envelope
    // For session events via ACP, the method maps to the event type
    // sandbox-agent sends notifications like:
    //   method: "notifications/event", params: { event: UniversalEvent }
    //   or directly as the event payload

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

      default:
        return []
    }
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
