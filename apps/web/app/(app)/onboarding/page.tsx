import { verifySession } from '@/lib/dal'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function OnboardingPage() {
  await verifySession()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50">
          Welcome to Ship
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Ship is an agent that works autonomously in the background on real coding tasks
          while you focus on other things.
        </p>
        <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
          Create sessions, assign tasks, and let Ship handle the implementation.
          Review progress, approve changes, and ship faster.
        </p>

        <div className="mt-8">
          <Link href="/dashboard">
            <Button variant="primary">Get Started</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
