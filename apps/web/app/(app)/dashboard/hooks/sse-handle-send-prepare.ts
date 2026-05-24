import { postSessionSync } from '@/lib/session-sync-channel'
import { sessionStatusStore } from './use-session-status-store'
import {
  createUserMessage,
  createAssistantPlaceholder,
} from '@/lib/ai-elements-adapter'
import { getStreamingRefs } from '@/lib/chat-store/store'
import { createSSEHandlerContext } from './sse-handler-context'
import type { useDashboardChat } from './use-dashboard-chat'
import type { UseSseHandleSendParams } from './use-sse-handle-send'

export function prepareChatSend(
  content: string,
  targetSessionId: string,
  chat: ReturnType<typeof useDashboardChat>,
  streamStartTimeRef: React.MutableRefObject<number | null>,
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>,
): { ctx: ReturnType<typeof createSSEHandlerContext>; accumulateSetupStepsRef: { current: boolean } } {
  terminalStreamSessionsRef.current.delete(targetSessionId)
  chat.setIsStreaming(true)
  postSessionSync({ type: 'session-streaming', sessionId: targetSessionId })
  chat.clearStreamingStatusSteps()
  const streamingRefs = getStreamingRefs(targetSessionId)
  streamingRefs.assistantTextRef.current = ''
  streamingRefs.reasoningRef.current = ''
  chat.setLastStepCost(null)
  const now = Date.now()
  streamStartTimeRef.current = now
  chat.setStreamStartTime(now)

  const hasCompletedAssistant = chat.messagesRef.current.some(
    (m) => m.role === 'assistant' && (m.content || m.toolInvocations?.length),
  )
  const accumulateSetupStepsRef = { current: !hasCompletedAssistant }
  chat.setStreamingStatus('Preparing...', accumulateSetupStepsRef.current)
  sessionStatusStore.update(targetSessionId, {
    isRunning: true,
    status: 'Preparing...',
    steps: [],
    contentPreview: '',
  })

  if (!chat.messagesRef.current.some((m) => m.role === 'user')) {
    chat.updateSessionTitleIfEmpty(targetSessionId, content)
  }
  chat.setMessages((prev) => [...prev, createUserMessage(content)])

  const assistantMessage = createAssistantPlaceholder()
  streamingRefs.streamingMessageRef.current = assistantMessage.id
  chat.setMessages((prev) => [...prev, assistantMessage])

  const ctx = createSSEHandlerContext(chat, targetSessionId, accumulateSetupStepsRef)
  return { ctx, accumulateSetupStepsRef }
}

export function queueChatSend(
  content: string,
  params: UseSseHandleSendParams,
): boolean {
  const { chat, isStreamingRef } = params
  if (isStreamingRef.current) {
    chat.setMessageQueue((q) => [...q, content])
    return true
  }
  return false
}
