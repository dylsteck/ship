'use client'

import { useEffect, useRef } from 'react'
import { fetchChatMessages, fetchChatEvents } from '@/lib/api/chat-client'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { mapApiMessagesToUI, replayEventsToMessages } from '@/lib/ai-elements-adapter'
import { hydrateEventsFromMessages, eventsStore } from './use-events-store'

function normalizeInitialMessages(msgs: UIMessage[]): UIMessage[] {
  return msgs.map((m) => ({
    ...m,
    createdAt:
      m.createdAt instanceof Date ? m.createdAt : typeof m.createdAt === 'string' ? new Date(m.createdAt) : undefined,
  }))
}

export interface UseChatHistoryLoaderParams {
  activeSessionId: string | null
  initialActiveSessionId: string | null
  rawInitialMessages?: UIMessage[]
  initialApiMessages?: Array<{ id: string; role: string; content: string; createdAt: number; parts?: string }>
  onResumeStream?: (sessionId: string) => void
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
}

export function useChatHistoryLoader({
  activeSessionId,
  initialActiveSessionId,
  rawInitialMessages,
  initialApiMessages,
  onResumeStream,
  setMessages,
}: UseChatHistoryLoaderParams) {
  const historyLoadedRef = useRef<string | null>(null)
  const onResumeStreamRef = useRef(onResumeStream)
  onResumeStreamRef.current = onResumeStream

  useEffect(() => {
    if (!activeSessionId) {
      historyLoadedRef.current = null
      setMessages((prev) => (prev.length === 0 ? prev : []))
      return
    }

    const hadInitialForThisSession = rawInitialMessages !== undefined && activeSessionId === initialActiveSessionId
    if (hadInitialForThisSession) {
      historyLoadedRef.current = activeSessionId
      setMessages(normalizeInitialMessages(rawInitialMessages!))
      fetchChatEvents(activeSessionId).then((events) => {
        if (events.length > 0) {
          eventsStore.replaceEvents(activeSessionId, events)
          if (initialApiMessages?.length) {
            setMessages(replayEventsToMessages(initialApiMessages, events))
          }
        } else if (initialApiMessages?.length) {
          hydrateEventsFromMessages(activeSessionId, initialApiMessages)
        }
      })
      onResumeStreamRef.current?.(activeSessionId)
      return
    }

    if (historyLoadedRef.current === activeSessionId) return
    historyLoadedRef.current = activeSessionId

    Promise.all([fetchChatMessages(activeSessionId, { limit: 100 }), fetchChatEvents(activeSessionId)])
      .then(([apiMessages, events]) => {
        const uiMessages =
          events.length > 0 ? replayEventsToMessages(apiMessages, events) : mapApiMessagesToUI(apiMessages)
        setMessages(uiMessages)
        if (events.length > 0) {
          eventsStore.replaceEvents(activeSessionId, events)
        } else {
          hydrateEventsFromMessages(activeSessionId, apiMessages)
        }
        onResumeStreamRef.current?.(activeSessionId)
      })
      .catch((err) => {
        console.error('Failed to load messages:', err)
      })

    return () => {
      historyLoadedRef.current = null
    }
  }, [activeSessionId, initialActiveSessionId, rawInitialMessages, initialApiMessages, setMessages])
}
