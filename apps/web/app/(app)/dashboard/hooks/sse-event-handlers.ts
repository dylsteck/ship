/**
 * Pure functions for handling SSE events.
 * No hooks — just typed dispatchers for each event type.
 */

import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { SessionInfo } from '@/lib/sse-types'
import type { TodoItem, FileDiff, StepCostInfo } from '../types'
import {
  processPartUpdated,
  createPermissionMessage,
  createQuestionMessage,
  createSystemMessage,
  createErrorMessage,
  updatePromptStatus,
  classifyError,
  parseErrorMessage,
  extractStepCost,
} from '@/lib/ai-elements-adapter'

export interface SSEHandlerContext {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  setIsStreaming: (value: boolean) => void
  setTotalCost: React.Dispatch<React.SetStateAction<number>>
  setLastStepCost: React.Dispatch<React.SetStateAction<StepCostInfo | null>>
  setSessionTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>
  setFileDiffs: React.Dispatch<React.SetStateAction<FileDiff[]>>
  setOpenCodeUrl: React.Dispatch<React.SetStateAction<string>>
  setSessionTitle: React.Dispatch<React.SetStateAction<string>>
  setSessionInfo: React.Dispatch<React.SetStateAction<SessionInfo | null>>
  setStreamStartTime: (value: number | null) => void
  streamingMessageRef: React.MutableRefObject<string | null>
  assistantTextRef: React.MutableRefObject<string>
  reasoningRef: React.MutableRefObject<string>
  targetSessionId: string
}

export function handleMessagePartUpdated(
  event: { properties: { part: any; delta?: string } },
  ctx: SSEHandlerContext,
  scheduleFlush: () => void,
) {
  const part = event.properties.part
  const delta = event.properties.delta

  if (part.type === 'text' || part.type === 'reasoning') {
    if (part.type === 'text') {
      if (typeof delta === 'string') {
        ctx.assistantTextRef.current += delta
      } else if ((part as { text?: string }).text) {
        ctx.assistantTextRef.current = (part as { text: string }).text
      }
    } else {
      if (typeof delta === 'string') {
        ctx.reasoningRef.current += delta
      } else if ((part as { text?: string }).text) {
        ctx.reasoningRef.current = (part as { text: string }).text
      }
    }
    scheduleFlush()
  } else {
    ctx.setMessages((prev) =>
      processPartUpdated(part, delta, ctx.streamingMessageRef.current!, prev, ctx.assistantTextRef, ctx.reasoningRef),
    )
  }

  if (part.type === 'step-finish') {
    const costInfo = extractStepCost(part)
    if (costInfo) {
      ctx.setLastStepCost(costInfo)
      ctx.setTotalCost((prev) => prev + costInfo.cost)
    }
  }
}

export function handleDoneOrIdle(
  ctx: SSEHandlerContext,
  streamStartTimeRef: React.MutableRefObject<number | null>,
) {
  const finalMsgId = ctx.streamingMessageRef.current
  if (finalMsgId) {
    const finalText = ctx.assistantTextRef.current
    const finalReasoning = ctx.reasoningRef.current
    const elapsed = streamStartTimeRef.current
      ? Date.now() - streamStartTimeRef.current
      : 0
    ctx.setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== finalMsgId) return m
        return {
          ...m,
          content: finalText,
          ...(finalReasoning ? { reasoning: [finalReasoning] } : {}),
          elapsed,
        }
      }),
    )
  }
  ctx.setIsStreaming(false)
  ctx.setStreamStartTime(null)
  ctx.streamingMessageRef.current = null
}

export function handleSessionError(
  errorData: { name?: string; data?: { message?: string }; message?: string } | undefined,
  ctx: SSEHandlerContext,
) {
  let errorMessage = 'An error occurred'
  if (errorData?.data?.message) {
    errorMessage = errorData.data.message
  } else if (errorData?.message) {
    errorMessage = errorData.message
  }

  const { category, retryable } = classifyError(errorMessage)
  ctx.setMessages((prev) => [...prev, createErrorMessage(errorMessage, category, retryable)])
  ctx.setIsStreaming(false)
  ctx.streamingMessageRef.current = null
}

export function handleGenericError(error: unknown, ctx: SSEHandlerContext) {
  const errorMessage = parseErrorMessage(error)
  const { category, retryable } = classifyError(errorMessage)
  ctx.setMessages((prev) => [...prev, createErrorMessage(errorMessage, category, retryable)])
  ctx.setIsStreaming(false)
  ctx.streamingMessageRef.current = null
}

export function handlePermissionAsked(
  props: { id: string; permission: string; description?: string; patterns?: string[] },
  ctx: SSEHandlerContext,
) {
  ctx.setMessages((prev) => [
    ...prev,
    createPermissionMessage(props.id, props.permission, props.description, props.patterns),
  ])
}

export function handlePermissionResolved(
  id: string,
  status: 'granted' | 'denied',
  ctx: SSEHandlerContext,
) {
  ctx.setMessages((prev) => updatePromptStatus(id, status, prev))
}

export function handleQuestionAsked(
  props: { id: string; text: string },
  ctx: SSEHandlerContext,
) {
  ctx.setMessages((prev) => [...prev, createQuestionMessage(props.id, props.text)])
}

export function handleQuestionResolved(
  id: string,
  status: 'replied' | 'rejected',
  ctx: SSEHandlerContext,
) {
  ctx.setMessages((prev) => updatePromptStatus(id, status, prev))
}

export function handleOpenCodeUrl(url: string, ctx: SSEHandlerContext) {
  ctx.setOpenCodeUrl(url)
  try { localStorage.setItem(`opencode-url-${ctx.targetSessionId}`, url) } catch {}
}

export function handleRawDataFallbacks(
  rawData: Record<string, unknown>,
  ctx: SSEHandlerContext,
) {
  // Handle wrapped event fallbacks
  if (rawData.type === 'event' && rawData.properties) {
    const innerEvent = rawData.properties as { type?: string; error?: unknown }
    if (innerEvent.type === 'session.error') {
      handleSessionError(
        innerEvent.error as { name?: string; data?: { message?: string }; message?: string },
        ctx,
      )
    }
  }

  if (rawData.type === 'assistant') {
    ctx.setMessages((prev) =>
      prev.map((m) =>
        m.id === ctx.streamingMessageRef.current
          ? { ...m, content: rawData.content as string, id: (rawData.id as string) || m.id }
          : m,
      ),
    )
  }

  if (rawData.prUrl) {
    ctx.setMessages((prev) => [
      ...prev,
      createSystemMessage(`Draft PR created: ${rawData.prUrl as string}`, 'pr-notification'),
    ])
  }
}
