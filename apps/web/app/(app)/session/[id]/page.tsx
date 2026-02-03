import { SessionPageClient } from './page-client'
import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const session = await verifySession()
  const user = await getUser()
  const { id: sessionId } = await params
  let sessions: ChatSession[] = []
  try {
    sessions = await fetchSessions(session.userId)
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
  }

  return (
    <SessionPageClient
      sessionId={sessionId}
      userId={session.userId}
      user={user}
      sessions={sessions}
    />
  )
}
