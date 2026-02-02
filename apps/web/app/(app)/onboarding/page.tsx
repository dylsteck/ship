import { verifySession } from '@/lib/dal'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function OnboardingPage() {
  await verifySession()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-background" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome to Ship
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
          Ship is an agent that works autonomously in the background on real coding tasks
          while you focus on other things.
        </p>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Create sessions, assign tasks, and let Ship handle the implementation.
        </p>

        <div className="mt-6">
          <Link href="/dashboard">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
