import type { Task, TaskRow } from './session-types'

/** Dependencies required by session task store helpers. */
export interface SessionTaskStoreHost {
  readonly sql: SqlStorage
  broadcast(message: object): void
}

/** Persist a new pending task and broadcast creation. */
export async function persistTask(
  host: SessionTaskStoreHost,
  task: Omit<Task, 'id' | 'createdAt' | 'status'>,
): Promise<Task> {
  const id = crypto.randomUUID()
  const createdAt = Math.floor(Date.now() / 1000)

  host.sql.exec(
    `INSERT INTO tasks (id, title, description, status, mode, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    id,
    task.title,
    task.description || null,
    task.mode,
    createdAt,
  )

  const saved: Task = {
    id,
    title: task.title,
    description: task.description,
    status: 'pending',
    mode: task.mode,
    createdAt,
  }

  host.broadcast({ type: 'task-created', task: saved })
  return saved
}

/** Update task status for FIFO processing. */
export async function updateTaskStatus(
  host: SessionTaskStoreHost,
  taskId: string,
  status: Task['status'],
  completedAt?: number,
): Promise<void> {
  host.sql.exec(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`, status, completedAt || null, taskId)
  host.broadcast({ type: 'task-updated', taskId, status, completedAt })
}

/** Next pending task in FIFO order. */
export async function getNextPendingTask(host: SessionTaskStoreHost): Promise<Task | null> {
  const row = host.sql
    .exec<TaskRow>(
      `SELECT id, title, description, status, mode, created_at, completed_at
       FROM tasks
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .one()

  if (!row) return null

  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status as Task['status'],
    mode: row.mode as Task['mode'],
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  }
}

/** All tasks with optional status filter. */
export async function getTasks(
  host: SessionTaskStoreHost,
  options?: { status?: Task['status']; limit?: number },
): Promise<Task[]> {
  let query = `SELECT id, title, description, status, mode, created_at, completed_at
               FROM tasks`
  const params: unknown[] = []

  if (options?.status) {
    query += ` WHERE status = ?`
    params.push(options.status)
  }

  query += ` ORDER BY created_at ASC`

  if (options?.limit) {
    query += ` LIMIT ?`
    params.push(options.limit)
  }

  const rows = host.sql.exec<TaskRow>(query, ...params).toArray()

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status as Task['status'],
    mode: row.mode as Task['mode'],
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  }))
}
