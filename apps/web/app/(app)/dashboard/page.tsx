import { verifySession, getUser } from '@/lib/dal'
import { fetchSessions, type ChatSession } from '@/lib/api'
import { DashboardSessions } from '@/components/session/dashboard-sessions'

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
          Welcome back, {user.name || user.username}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your coding sessions and track progress</p>
      </div>

      {/* Sessions section - main dashboard view */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <DashboardSessions initialSessions={sessions} userId={session.userId} />
      </div>
    </div>
  )
}
