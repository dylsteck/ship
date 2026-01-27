import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { TaskPageClient } from '@/components/task-page-client'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TaskPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession()

  if (!session?.user?.id) {
    notFound()
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1)

  if (!task) {
    notFound()
  }

  return <TaskPageClient initialTask={task} />
}
