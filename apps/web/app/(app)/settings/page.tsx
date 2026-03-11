import { cookies } from 'next/headers'
import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
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

  return (
    <SettingsClient
      userId={session.userId}
      user={user}
      sessions={sessions}
      apiToken={apiToken}
    />
  )
}
