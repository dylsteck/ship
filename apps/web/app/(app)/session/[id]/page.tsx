import { cookies } from 'next/headers'
import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, getSession, getChatMessages, type ChatSession } from '@/lib/api'
import { mapApiMessagesToUI } from '@/lib/ai-elements-adapter'
import { DashboardClient } from '../../dashboard/dashboard-client'
import { SessionLoadingFallback } from '@/components/session/session-loading-fallback'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params
  const session = await verifySession()
  const user = await getUser()
  const cookieStore = await cookies()
  const apiToken = cookieStore.get('session')?.value ?? ''

  let sessions: ChatSession[] = []
  try {
    sessions = await fetchSessions(session.userId)
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
  }

  let sessionDetails: ChatSession | null = null
  try {
    sessionDetails = await getSession(id)
  } catch (error) {
    console.error('Failed to fetch session details:', error)
  }

  const matchingSession = sessionDetails || sessions.find((existingSession) => existingSession.id === id)

  // If we can't find the session server-side, render a client fallback that retries
  if (!matchingSession || matchingSession.userId !== session.userId) {
    return (
      <SessionLoadingFallback
        sessionId={id}
        userId={session.userId}
        user={user}
      />
    )
  }

  const mergedSessions = sessions.some((existingSession) => existingSession.id === id)
    ? sessions.map((existingSession) =>
        existingSession.id === id ? { ...existingSession, ...matchingSession } : existingSession,
      )
    : [matchingSession, ...sessions]

  let initialMessages: Awaited<ReturnType<typeof mapApiMessagesToUI>> = []
  try {
    const apiMessages = await getChatMessages(id, { limit: 100 })
    initialMessages = mapApiMessagesToUI(apiMessages)
  } catch (error) {
    console.error('Failed to fetch messages:', error)
  }

  const serverTimestamp = Math.floor(Date.now() / 1000)

  return (
    <DashboardClient
      sessions={mergedSessions}
      userId={session.userId}
      user={user}
      initialSessionId={id}
      initialMessages={initialMessages}
      serverTimestamp={serverTimestamp}
      apiToken={apiToken}
    />
  )
}
