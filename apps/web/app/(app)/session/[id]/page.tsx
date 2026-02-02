import { SessionPageClient } from './page-client'
import { verifySession } from '@/lib/dal'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  await verifySession()
  const { id: sessionId } = await params

  return <SessionPageClient sessionId={sessionId} />
}
