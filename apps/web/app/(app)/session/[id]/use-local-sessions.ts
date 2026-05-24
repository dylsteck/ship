'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSession } from '@/lib/api/server'

export function useLocalSessions(initialSessions: ChatSession[], currentSessionId: string) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)

  const removeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (currentSessionId === sessionId) {
      router.push('/')
      window.location.href = '/'
    }
  }

  return { sessions, removeSession }
}
