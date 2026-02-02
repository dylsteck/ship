import { verifySession } from '@/lib/dal'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await verifySession()

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  )
}
