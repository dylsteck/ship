import { redirect } from 'next/navigation'
import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api'
import { DashboardClient } from './(app)/dashboard/dashboard-client'

export default async function HomePage() {
  const session = await verifySession()
  const user = await getUser()

  let sessions: ChatSession[] = []
  try {
    sessions = await fetchSessions(session.userId)
  } catch (error) {
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
