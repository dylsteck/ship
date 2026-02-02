import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const session = await verifySession()
  const user = await getUser()

  // Fetch sessions for the current user
  let sessions: ChatSession[] = []
  try {
    sessions = await fetchSessions(session.userId)
  } catch (error) {
    // Log error but don't fail the page - show empty state
    console.error('Failed to fetch sessions:', error)
  }

  return (
    <DashboardClient 
      sessions={sessions} 
      userId={session.userId}
      user={user}
    />
  )
}
