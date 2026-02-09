import { verifySession } from '@/lib/dal'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await verifySession()

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      {children}
    </div>
  )
}
