import { verifySession, getUser } from '@/lib/dal'

export default async function DashboardPage() {
  await verifySession()
  const user = await getUser()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
          Welcome back, {user.name || user.username}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your coding sessions and track progress
        </p>
      </div>

      {/* User info card */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Account Information
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{user.username}</dd>
          </div>
          {user.name && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{user.name}</dd>
            </div>
          )}
          {user.email && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{user.email}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Sessions placeholder */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Your Sessions
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Session management will be available in Phase 2.
        </p>
      </div>
    </div>
  )
}
