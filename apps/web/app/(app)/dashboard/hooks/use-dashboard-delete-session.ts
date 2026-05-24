'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSession } from '@/lib/api/server'
import type { useDashboardChat } from './use-dashboard-chat'

export function useDashboardDeleteSession(
  chat: ReturnType<typeof useDashboardChat>,
  deleteSession: (arg: { sessionId: string }) => Promise<unknown>,
  mutateSessions?: () => void,
  onSessionDeleted?: () => void,
) {
  const router = useRouter()

  return useCallback(
    async (sessionId: string) => {
      const session = chat.localSessions.find((s) => s.id === sessionId)
      chat.setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId))
      mutateSessions?.()
      onSessionDeleted?.()
      try {
        await deleteSession({ sessionId })
        if (chat.activeSessionId === sessionId) {
          chat.setActiveSessionId(null)
          chat.setMessages([])
          router.push('/')
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Failed to delete session:', error)
        if (session) {
          chat.setLocalSessions((prev) =>
            [...prev, session].sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0)),
          )
        }
      }
    },
    [chat, deleteSession, mutateSessions, onSessionDeleted, router],
  )
}

export function useDashboardSessionNavigation(chat: ReturnType<typeof useDashboardChat>) {
  const router = useRouter()

  return useCallback(
    (session: ChatSession) => {
      chat.setActiveSessionId(session.id)
      chat.connectWebSocket(session.id)
      router.push(`/session/${session.id}`)
    },
    [chat, router],
  )
}
