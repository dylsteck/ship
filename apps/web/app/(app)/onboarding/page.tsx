import { verifySession } from '@/lib/dal'
import Link from 'next/link'
import { Button } from '@ship/ui'

export default async function OnboardingPage() {
  await verifySession()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center px-4">
      <div className="text-center">
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
          <Link href="/">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
