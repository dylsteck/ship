import type { ToolPart, ReasoningPart, TextPart, MessagePart, StepFinishPart, PlanPart } from '@/lib/sse-types'
import {
  createToolInvocation,
  processPartUpdated,
  type UIMessage,
  type ToolInvocation,
  type OrderedMessagePart,
} from './ai-elements-adapter'

// ============ API Message → UIMessage Mapping ============

interface ApiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  parts?: string // JSON string of MessagePart[]
  inlineTools?: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    input: Record<string, unknown>
    output?: unknown
    duration?: number
  }>
  reasoningBlocks?: Array<{ text: string }>
}

function upsertOrderedTextPart(
  orderedParts: OrderedMessagePart[],
  kind: 'text' | 'reasoning',
  id: string,
  text: string,
): void {
  const index = orderedParts.findIndex((ordered) => ordered.kind === kind && ordered.id === id)
  if (index === -1) orderedParts.push({ id, kind, text })
  else orderedParts[index] = { id, kind, text }
}

/**
 * If content is a JSON array of text parts (e.g. [{"text":"...","type":"text"}]),
 * extract and join the text. Otherwise return as-is.
 */
function extractTextContent(content: string): string {
  if (!content || !content.startsWith('[')) return content
  try {
    const parts = JSON.parse(content)
    if (Array.isArray(parts) && parts.length > 0 && parts[0]?.type === 'text') {
      return parts
        .filter((p: { type: string; text?: string }) => p.type === 'text' && p.text && !p.text.startsWith('agentId:'))
        .map((p: { text: string }) => p.text)
        .join('\n\n')
    }
  } catch {
    // Not JSON, return as-is
  }
  return content
}

/**
 * Map an array of API messages to UIMessages (for loading history on reload).
 * Parses the `parts` JSON string to restore reasoning, tool invocations, and elapsed time.
 */
export function mapApiMessagesToUI(apiMessages: ApiMessage[]): UIMessage[] {
  return apiMessages.map((msg) => {
    const uiMsg: UIMessage = {
      id: msg.id,
      role: msg.role,
      content: extractTextContent(msg.content),
      createdAt: new Date(msg.createdAt * 1000),
    }

    // Try to parse the `parts` JSON string first — it's the most complete source
    if (msg.parts) {
      try {
        const parts = JSON.parse(msg.parts) as MessagePart[]
        const tools: ToolInvocation[] = []
        let elapsed: number | undefined
        let planItems: Array<{ id: string; title: string; status: string }> | undefined
        const orderedParts: OrderedMessagePart[] = []

        for (const part of parts) {
          const partType = (part as { type: string }).type
          if (partType === 'error') {
            const ep = part as unknown as {
              type: 'error'
              category?: string
              retryable?: boolean
              action?: { label: string; href: string }
            }
            uiMsg.type = 'error'
            uiMsg.errorCategory = (ep.category as UIMessage['errorCategory']) || 'persistent'
            uiMsg.retryable = ep.retryable ?? false
            if (ep.action?.label && ep.action?.href) uiMsg.errorAction = ep.action
            continue
          }
          switch (part.type) {
            case 'tool': {
              const tp = part as ToolPart
              const invocation = createToolInvocation(tp)
              const toolIndex = tools.findIndex((tool) => tool.toolCallId === invocation.toolCallId)
              if (toolIndex === -1) tools.push(invocation)
              else tools[toolIndex] = invocation
              const index = orderedParts.findIndex(
                (ordered) => ordered.kind === 'tool' && ordered.id === invocation.toolCallId,
              )
              if (index === -1) {
                orderedParts.push({ id: invocation.toolCallId, kind: 'tool', tool: invocation })
              } else orderedParts[index] = { id: invocation.toolCallId, kind: 'tool', tool: invocation }
              break
            }
            case 'reasoning': {
              const rp = part as ReasoningPart
              if (rp.text) {
                upsertOrderedTextPart(orderedParts, 'reasoning', rp.id, rp.text)
              }
              break
            }
            case 'text': {
              const txp = part as TextPart
              if (txp.text) {
                upsertOrderedTextPart(orderedParts, 'text', txp.id, txp.text)
              }
              break
            }
            case 'plan': {
              const pp = part as PlanPart
              if (pp.items) {
                planItems = pp.items
                orderedParts.push({ id: pp.id, kind: 'plan', items: pp.items })
              }
              break
            }
            case 'step-finish': {
              const sfp = part as StepFinishPart
              if (sfp.cost !== undefined) {
                // Use timing from the part if available
                const time = (sfp as StepFinishPart & { time?: { start: number; end?: number } }).time
                if (time?.start && time?.end) {
                  elapsed = time.end - time.start
                }
              }
              break
            }
          }
        }

        const orderedReasoningText = orderedParts
          .filter((part): part is Extract<OrderedMessagePart, { kind: 'reasoning' }> => part.kind === 'reasoning')
          .map((part) => part.text)
        const orderedText = orderedParts
          .filter((part): part is Extract<OrderedMessagePart, { kind: 'text' }> => part.kind === 'text')
          .map((part) => part.text)
          .join('')

        if (tools.length > 0) uiMsg.toolInvocations = tools
        if (orderedReasoningText.length > 0) uiMsg.reasoning = orderedReasoningText
        if (planItems) uiMsg.planItems = planItems
        if (orderedParts.length > 0) uiMsg.orderedParts = orderedParts
        if (!uiMsg.content && orderedText) uiMsg.content = orderedText
        if (elapsed) uiMsg.elapsed = elapsed

        return uiMsg
      } catch {
        // Fall through to legacy fields
      }
    }

    // Fallback: use inlineTools and reasoningBlocks
    if (msg.inlineTools?.length) {
      uiMsg.toolInvocations = msg.inlineTools.map((t) => ({
        toolCallId: `${msg.id}-${t.name}`,
        toolName: t.name,
        state:
          t.status === 'completed'
            ? ('result' as const)
            : t.status === 'failed'
              ? ('error' as const)
              : ('call' as const),
        args: t.input,
        result: t.output,
        duration: t.duration,
      }))
    }
    if (msg.reasoningBlocks?.length) {
      const lastBlock = msg.reasoningBlocks[msg.reasoningBlocks.length - 1]
      if (lastBlock?.text) uiMsg.reasoning = [lastBlock.text]
    }
    return uiMsg
  })
}

/** Raw event from getChatEvents (Overview inspector persistence) */
export interface RawEvent {
  id: string
  type: string
  timestamp: number
  payload: unknown
}

/**
 * Replay persisted SSE events to derive messages with full tool invocations.
 * When events exist, they are the canonical source — messages from API may have
 * incomplete/compacted parts. Replaying ensures identical state across tabs/reloads.
 */
export function replayEventsToMessages(
  apiMessages: Array<{ id: string; role: string; content: string; createdAt: number; parts?: string }>,
  events: RawEvent[],
): UIMessage[] {
  const base = mapApiMessagesToUI(apiMessages as ApiMessage[])
  const partEvents = events.filter((e) => {
    if (e.type !== 'message.part.updated') return false
    const payload = e.payload as Record<string, unknown>
    const part = payload?.properties && (payload.properties as Record<string, unknown>)?.part
    return part && typeof (part as Record<string, unknown>).type === 'string'
  })
  if (partEvents.length === 0) return base

  // Map part.messageID (from translator) -> assistant message index (by first appearance order)
  const msgIdToAsstIndex = new Map<string, number>()
  let asstIndex = 0
  for (const e of partEvents) {
    const part = ((e.payload as Record<string, unknown>).properties as Record<string, unknown>)?.part as Record<
      string,
      unknown
    >
    const msgId = part?.messageID as string
    if (msgId && !msgIdToAsstIndex.has(msgId)) {
      msgIdToAsstIndex.set(msgId, asstIndex++)
    }
  }

  const asstIndices: number[] = []
  base.forEach((m, i) => {
    if (m.role === 'assistant') asstIndices.push(i)
  })

  const mockTextRef = { current: '' }
  const mockReasoningRef = { current: '' }
  const mockOrderedPartsRef = { current: [] as OrderedMessagePart[] }
  let lastMsgIdx = -1
  let result = [...base]

  for (const e of partEvents) {
    const props = (e.payload as Record<string, unknown>).properties as Record<string, unknown>
    const part = props?.part as MessagePart
    const delta = props?.delta as string | undefined
    const msgId = (part as Record<string, unknown>)?.messageID as string
    const asstIdx = msgIdToAsstIndex.get(msgId)
    if (asstIdx === undefined) continue
    while (asstIdx >= asstIndices.length) {
      const createdAt = typeof e.timestamp === 'number' ? new Date(e.timestamp) : new Date()
      result.push({ id: `assistant-replay-${msgId || asstIndices.length}`, role: 'assistant', content: '', createdAt })
      asstIndices.push(result.length - 1)
    }
    const msgIdx = asstIndices[asstIdx]
    if (msgIdx !== lastMsgIdx) {
      mockTextRef.current = ''
      mockReasoningRef.current = ''
      mockOrderedPartsRef.current = []
      lastMsgIdx = msgIdx
    }
    const streamingMsgId = result[msgIdx]!.id
    result = processPartUpdated(part, delta, streamingMsgId, result, mockTextRef, mockReasoningRef, mockOrderedPartsRef)
  }

  return preserveFullPersistedAssistantText(base, result)
}

function preserveFullPersistedAssistantText(base: UIMessage[], replayed: UIMessage[]): UIMessage[] {
  const baseAssistants = base.filter((m) => m.role === 'assistant')
  let assistantIndex = 0
  return replayed.map((message) => {
    if (message.role !== 'assistant') return message
    const persisted = baseAssistants[assistantIndex++]
    if (!persisted?.content) return message
    if ((message.content?.length ?? 0) >= persisted.content.length) return message
    return { ...message, content: persisted.content }
  })
}
