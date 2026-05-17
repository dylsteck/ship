import { cookies } from 'next/headers'
import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api/server'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const session = await verifySession()
  const user = await getUser()
  const cookieStore = await cookies()
  const apiToken = cookieStore.get('session')?.value ?? ''
  const sidebarOpen = cookieStore.get('sidebar_state')?.value === 'true'

  let sessions: ChatSession[] = []
  try {
    sessions = await fetchSessions()
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
  }

  return (
    <SettingsClient
      user={user}
      sessions={sessions}
      apiToken={apiToken}
      sidebarDefaultOpen={sidebarOpen}
    />
  )
}
