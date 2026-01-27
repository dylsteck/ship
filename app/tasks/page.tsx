import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import { eq, desc, isNull, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { redirect } from 'next/navigation'
import { TasksListClient } from '@/components/tasks-list-client'

export default async function TasksPage() {
  const session = await getServerSession()

  if (!session?.user?.id) {
    redirect('/')
  }

  const userTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .orderBy(desc(tasks.createdAt))

  return <TasksListClient initialTasks={userTasks} />
}
