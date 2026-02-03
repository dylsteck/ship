import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import DashboardPage from './(app)/dashboard/page'

export default async function HomePage() {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  return <DashboardPage />
}
