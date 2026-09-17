'use client'

/** Bridge canonical session controller state into the existing dashboard surface. */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CreateTurnRequest, RealtimeMessage } from '@ship/contracts'
import { createAssistantPlaceholder, createErrorMessage, createUserMessage } from '@/lib/ai-elements-adapter'
import { mapApiMessagesToUI } from '@/lib/ai-elements-history'
import {
  useActiveSessionController,
  useSessionControllerRegistry,
} from '@/lib/realtime/session-controller-provider'
import type { useDashboardChat } from './use-dashboard-chat'

/** Canonical command/subscription facade used when realtime v2 is enabled. */
export function useDashboardRealtime(
  chat: ReturnType<typeof useDashboardChat>,
  modeRef: React.MutableRefObject<string>,
  modelIdRef: React.MutableRefObject<string | null>,
) {
  const registry = useSessionControllerRegistry()
  const { controller, state } = useActiveSessionController(chat.activeSessionId)
  const pendingCommands = useRef(new Map<string, { command: CreateTurnRequest; attempts: number }>())

  const controllerMessages = useMemo(
    () => mapRealtimeMessages([...state.orderedMessageIds].map((id) => state.messagesById.get(id)).filter(Boolean)),
    [state.messagesById, state.orderedMessageIds],
  )

  useEffect(() => {
    if (!chat.activeSessionId || !state.hasSnapshot) return
    if (
      controllerMessages.length === 0 &&
      chat.messagesRef.current.some((message) => message.role === 'user' || message.content)
    ) {
      return
    }
    chat.setMessages(controllerMessages)
    const latestAssistant = [...controllerMessages].reverse().find((message) => message.role === 'assistant')
    chat.streamingMessageRef.current = latestAssistant?.id ?? null
  }, [
    chat.activeSessionId,
    chat.messagesRef,
    chat.setMessages,
    chat.streamingMessageRef,
    controllerMessages,
    state.hasSnapshot,
  ])

  const isRunning = state.summary
    ? ['starting', 'running', 'stopping'].includes(state.summary.runtime.state)
    : [...state.turnsById.values()].some((turn) => turn.status === 'running')

  useEffect(() => {
    chat.setIsStreaming(isRunning)
  }, [chat.setIsStreaming, isRunning])

  const handleSend = useCallback(
    async (content: string, modeOverride?: string, sessionIdOverride?: string) => {
      const sessionId = sessionIdOverride ?? chat.activeSessionId
      if (!sessionId || !content.trim()) return
      const existing = pendingCommands.current.get(sessionId)
      const command: CreateTurnRequest = existing?.command ?? {
        content: content.trim(),
        mode: (modeOverride ?? modeRef.current) === 'plan' ? 'plan' : 'agent',
        ...(modelIdRef.current ? { modelId: modelIdRef.current } : {}),
        clientCommandId: crypto.randomUUID(),
      }
      pendingCommands.current.set(sessionId, { command, attempts: existing?.attempts ?? 0 })
      chat.setIsStreaming(true)
      if (sessionId === chat.activeSessionId) {
        chat.setMessages((previous) => [
          ...previous,
          createUserMessage(command.content),
          createAssistantPlaceholder(),
        ])
      }
      try {
        await acceptWithAmbiguousRetry(registry.get(sessionId), command)
        pendingCommands.current.delete(sessionId)
      } catch (error) {
        pendingCommands.current.delete(sessionId)
        chat.setIsStreaming(false)
        if (sessionId === chat.activeSessionId) {
          chat.setMessages((previous) => [
            ...previous.filter((message) => message.content || message.role !== 'assistant'),
            createErrorMessage(error instanceof Error ? error.message : 'Could not start the turn.', 'transient', true),
          ])
        }
      }
    },
    [chat, modeRef, modelIdRef, registry],
  )

  const handleStop = useCallback(async () => {
    if (!controller) return
    try {
      await controller.stopActiveTurn()
    } catch (error) {
      chat.setMessages((previous) => [
        ...previous,
        createErrorMessage(error instanceof Error ? error.message : 'Could not stop the turn.'),
      ])
    }
  }, [chat, controller])

  const resumeStream = useCallback(() => undefined, [])
  const processStreamEventForSession = useCallback(() => undefined, [])

  return { handleSend, handleStop, processStreamEventForSession, resumeStream, controllerState: state }
}

async function acceptWithAmbiguousRetry(
  controller: ReturnType<ReturnType<typeof useSessionControllerRegistry>['get']>,
  command: CreateTurnRequest,
): Promise<void> {
  try {
    await controller.createTurn(command)
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    try {
      await controller.createTurn(command)
    } catch {
      throw firstError
    }
  }
}

function mapRealtimeMessages(messages: Array<RealtimeMessage | undefined>) {
  return mapApiMessagesToUI(
    messages.flatMap((message) =>
      message
        ? [{
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
            ...(message.parts ? { parts: JSON.stringify(message.parts) } : {}),
          }]
        : [],
    ),
  )
}
