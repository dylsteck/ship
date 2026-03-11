import { cookies } from 'next/headers'
import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api'
import { DashboardClient } from './(app)/dashboard/dashboard-client'

export default async function HomePage() {
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

  const serverTimestamp = Math.floor(Date.now() / 1000)

  return (
    <DashboardClient
      sessions={sessions}
      userId={session.userId}
      user={user}
      initialSessionId={null}
      serverTimestamp={serverTimestamp}
      apiToken={apiToken}
    />
  )
}
