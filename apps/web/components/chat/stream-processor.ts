import type { AgentStatus } from '@/components/session/status-indicator'
import type { MessagePart } from '@/lib/sse-types'
import {
  type UIMessage,
  processPartUpdated,
  createErrorMessage,
  createSystemMessage,
  classifyError,
} from '@/lib/ai-elements-adapter'

interface StreamProcessorOptions {
  streamingMessageId: string
  assistantTextRef: React.RefObject<string>
  reasoningRef: React.RefObject<string>
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  setIsStreaming: (v: boolean) => void
  clearStreamingRef: () => void
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
}

/** Process a single parsed SSE data object during chat streaming */
export function processStreamEvent(
  data: Record<string, unknown>,
  opts: StreamProcessorOptions,
): void {
  const { streamingMessageId, assistantTextRef, reasoningRef, setMessages, setIsStreaming, clearStreamingRef, onStatusChange } = opts

  if (data.type === 'message.part.updated') {
    const props = data.properties as { part?: MessagePart; delta?: string } | undefined
    const part = props?.part
    const delta = props?.delta

    if (part) {
      setMessages((prev) =>
        processPartUpdated(part, delta, streamingMessageId, prev, assistantTextRef, reasoningRef),
      )
      updateStatusFromPart(part, onStatusChange)
    }
  }

  if (data.type === 'done' || data.type === 'session.idle') {
    setIsStreaming(false)
    clearStreamingRef()
    onStatusChange?.('idle')
  }

  if (data.type === 'assistant') {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === streamingMessageId
          ? { ...m, content: data.content as string, id: (data.id as string) || m.id }
          : m,
      ),
    )
  }

  if (data.error) {
    const errorContent = typeof data.error === 'string' ? data.error : 'An error occurred'
    const { category, retryable } = classifyError(errorContent)
    const errorCategory = (data.category as UIMessage['errorCategory']) || category
    setMessages((prev) => [...prev, createErrorMessage(errorContent, errorCategory, retryable)])
    setIsStreaming(false)
    clearStreamingRef()
    onStatusChange?.('error')
  }

  if (data.prUrl) {
    setMessages((prev) => [
      ...prev,
      createSystemMessage(`Draft PR created: ${data.prUrl}`, 'pr-notification'),
    ])
  }
}

function updateStatusFromPart(
  part: MessagePart,
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void,
): void {
  if (!onStatusChange) return

  if (part.type === 'text') {
    onStatusChange('coding', 'Writing response...')
  } else if (part.type === 'tool') {
    const toolName = (part.tool || '').toLowerCase()
    let status: AgentStatus = 'coding'
    if (toolName.includes('read') || toolName.includes('search') || toolName.includes('glob') || toolName.includes('grep')) {
      status = 'planning'
    } else if (toolName.includes('run') || toolName.includes('exec') || toolName.includes('bash')) {
      status = 'executing'
    }
    onStatusChange(status, part.tool)
  } else if (part.type === 'reasoning') {
    onStatusChange('planning', 'Reasoning...')
  }
}

/** Parse an SSE buffer chunk into lines, processing complete events. Returns remaining buffer. */
export function parseSSELines(
  buffer: string,
  onEvent: (data: Record<string, unknown>) => void,
): string {
  const lines = buffer.split('\n')
  const remaining = lines.pop() || ''
  let currentEventType = ''

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEventType = line.slice(7).trim()
      continue
    }
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6))
        if (!data.type && currentEventType) {
          data.type = currentEventType
        }
        onEvent(data)
      } catch {
        // Ignore parse errors
      }
    }
  }

  return remaining
}
