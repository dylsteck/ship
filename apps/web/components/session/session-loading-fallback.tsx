'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { setApiToken } from '@/lib/api/configure'
import { useSession } from '@/lib/api/hooks/use-sessions'
import { DashboardClient } from '@/app/(app)/dashboard/dashboard-client'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'

interface SessionLoadingFallbackProps {
  sessionId: string
  user: User
  apiToken?: string
}

export function SessionLoadingFallback({ sessionId, user, apiToken }: SessionLoadingFallbackProps) {
  if (apiToken) setApiToken(apiToken)
  const { session, isError } = useSession(sessionId)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    setTimedOut(false)
    const timer = setTimeout(() => setTimedOut(true), 10_000)
    return () => clearTimeout(timer)
  }, [sessionId])

  if (session) {
    return (
      <DashboardClient
        sessions={[session]}
        user={user}
        initialSessionId={sessionId}
        apiToken={apiToken}
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
