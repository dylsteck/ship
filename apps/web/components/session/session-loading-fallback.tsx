'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/api/hooks/use-sessions'
import { DashboardClient } from '@/app/(app)/dashboard/dashboard-client'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'

interface SessionLoadingFallbackProps {
  sessionId: string
  userId: string
  user: User
}

export function SessionLoadingFallback({ sessionId, userId, user }: SessionLoadingFallbackProps) {
  const { session, isError } = useSession(sessionId)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  if (session) {
    return (
      <DashboardClient
        sessions={[session]}
        userId={userId}
        user={user}
        initialSessionId={sessionId}
      />
    )
  }

  if (timedOut || isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Session not found</p>
          <Link
            href="/"
            className="inline-block text-sm text-primary hover:underline"
          >
            Go home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center space-y-3">
        <div className="size-5 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    </div>
  )
}
