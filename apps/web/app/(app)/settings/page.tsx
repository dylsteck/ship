import { getSession } from '@/lib/session'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const session = await getSession()

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Please log in to access settings</p>
      </div>
    )
  }

  return <SettingsClient userId={session.userId} />
}
