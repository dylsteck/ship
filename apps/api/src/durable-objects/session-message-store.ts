import type { Env } from '../env.d'
import {
  isMissingPartsColumnError,
  type Message,
  type MessageRow,
} from './session-types'

/** Dependencies required by session message store helpers. */
export interface SessionMessageStoreHost {
  readonly sql: SqlStorage
  getEnv(): Env
  getSessionIdForD1(): Promise<string | null>
  broadcast(message: object): void
}

/** Load recent messages from DO SQLite, falling back to D1 on cold start. */
export async function getRecentMessages(host: SessionMessageStoreHost, limit: number = 25): Promise<MessageRow[]> {
  const cursor = host.sql.exec<MessageRow>(
    `SELECT id, role, content, parts, created_at
     FROM messages
     ORDER BY created_at DESC
     LIMIT ?`,
    limit,
  )
  const rows = cursor.toArray()

  if (rows.length > 0) {
    return rows.reverse()
  }

  const sessionId = await host.getSessionIdForD1()
  if (!sessionId) return []

  try {
    const result = await host.getEnv().DB.prepare(
      `SELECT id, role, content, parts, created_at
       FROM chat_messages WHERE session_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
      .bind(sessionId, limit)
      .all()

    if (result.results?.length) {
      for (const row of result.results) {
        host.sql.exec(
          `INSERT OR IGNORE INTO messages (id, role, content, parts, created_at) VALUES (?, ?, ?, ?, ?)`,
          row.id,
          row.role,
          row.content,
          row.parts,
          row.created_at,
        )
      }
      return (result.results as unknown as MessageRow[]).reverse()
    }
  } catch (e) {
    if (isMissingPartsColumnError(e)) {
      const result = await host.getEnv().DB.prepare(
        `SELECT id, role, content, created_at
         FROM chat_messages WHERE session_id = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
        .bind(sessionId, limit)
        .all()

      if (result.results?.length) {
        for (const row of result.results) {
          host.sql.exec(
            `INSERT OR IGNORE INTO messages (id, role, content, parts, created_at) VALUES (?, ?, ?, ?, ?)`,
            row.id,
            row.role,
            row.content,
            null,
            row.created_at,
          )
        }
        return result.results
          .map((row) => ({
            id: row.id as string,
            role: row.role as string,
            content: row.content as string,
            parts: null,
            created_at: row.created_at as number,
          }))
          .reverse()
      }
    }
    console.warn(`[SessionDO] Failed to load recent messages from D1: ${e}`)
  }

  return []
}

/** Persist a message to DO SQLite and D1, then broadcast to WebSocket clients. */
export async function persistMessage(
  host: SessionMessageStoreHost,
  message: Omit<Message, 'id' | 'createdAt'>,
): Promise<Message> {
  const id = crypto.randomUUID()
  const createdAt = Math.floor(Date.now() / 1000)

  host.sql.exec(
    `INSERT INTO messages (id, role, content, parts, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    id,
    message.role,
    message.content,
    message.parts || null,
    createdAt,
  )

  const saved: Message = {
    id,
    role: message.role,
    content: message.content,
    parts: message.parts,
    createdAt,
  }

  const sessionId = await host.getSessionIdForD1()
  if (sessionId) {
    try {
      await host.getEnv().DB.prepare(
        `INSERT OR IGNORE INTO chat_messages (id, session_id, role, content, parts, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(saved.id, sessionId, saved.role, saved.content, saved.parts || null, saved.createdAt)
        .run()
    } catch (e) {
      if (isMissingPartsColumnError(e)) {
        await host.getEnv().DB.prepare(
          `INSERT OR IGNORE INTO chat_messages (id, session_id, role, content, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
          .bind(saved.id, sessionId, saved.role, saved.content, saved.createdAt)
          .run()
      } else {
        console.warn(`[SessionDO] Failed to write message to D1: ${e}`)
      }
    }
  }

  host.broadcast({ type: 'message', message: saved })
  return saved
}

/** Paginated message load in chronological order. */
export async function getMessages(
  host: SessionMessageStoreHost,
  options: { limit?: number; before?: string } = {},
): Promise<Message[]> {
  const limit = options.limit || 25

  let query = `SELECT id, role, content, parts, created_at as createdAt
               FROM messages`
  const params: unknown[] = []

  if (options.before) {
    const cursor = host.sql.exec(`SELECT created_at FROM messages WHERE id = ?`, options.before).one()

    if (cursor) {
      query += ` WHERE created_at < ?`
      params.push(cursor.created_at)
    }
  }

  query += ` ORDER BY created_at DESC LIMIT ?`
  params.push(limit)

  const rows = host.sql.exec(query, ...params).toArray()

  if (rows.length > 0) {
    return rows.reverse().map((row) => ({
      id: row.id as string,
      role: row.role as Message['role'],
      content: row.content as string,
      parts: row.parts as string | undefined,
      createdAt: row.createdAt as number,
    }))
  }

  const sessionId = await host.getSessionIdForD1()
  if (!sessionId) return []

  try {
    const result = await host.getEnv().DB.prepare(
      `SELECT id, role, content, parts, created_at as createdAt
       FROM chat_messages WHERE session_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
      .bind(sessionId, limit)
      .all()

    if (result.results?.length) {
      for (const row of result.results) {
        host.sql.exec(
          `INSERT OR IGNORE INTO messages (id, role, content, parts, created_at) VALUES (?, ?, ?, ?, ?)`,
          row.id,
          row.role,
          row.content,
          row.parts,
          row.createdAt,
        )
      }
      return result.results.reverse().map((row) => ({
        id: row.id as string,
        role: row.role as Message['role'],
        content: row.content as string,
        parts: row.parts as string | undefined,
        createdAt: row.createdAt as number,
      }))
    }
  } catch (e) {
    if (isMissingPartsColumnError(e)) {
      const result = await host.getEnv().DB.prepare(
        `SELECT id, role, content, created_at as createdAt
         FROM chat_messages WHERE session_id = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
        .bind(sessionId, limit)
        .all()

      if (result.results?.length) {
        for (const row of result.results) {
          host.sql.exec(
            `INSERT OR IGNORE INTO messages (id, role, content, parts, created_at) VALUES (?, ?, ?, ?, ?)`,
            row.id,
            row.role,
            row.content,
            null,
            row.createdAt,
          )
        }
        return result.results.reverse().map((row) => ({
          id: row.id as string,
          role: row.role as Message['role'],
          content: row.content as string,
          createdAt: row.createdAt as number,
        }))
      }
    }
    console.warn(`[SessionDO] Failed to load messages from D1: ${e}`)
  }

  return []
}

/** Update streaming message parts in DO SQLite and D1. */
export async function updateMessageParts(host: SessionMessageStoreHost, messageId: string, parts: string): Promise<void> {
  host.sql.exec(`UPDATE messages SET parts = ? WHERE id = ?`, parts, messageId)

  try {
    await host.getEnv().DB.prepare(`UPDATE chat_messages SET parts = ? WHERE id = ?`).bind(parts, messageId).run()
  } catch (e) {
    console.warn(`[SessionDO] Failed to update message parts in D1: ${e}`)
  }

  host.broadcast({ type: 'message-parts', messageId, parts })
}

/** Total message count for session list display. */
export async function getMessageCount(host: SessionMessageStoreHost): Promise<number> {
  const result = host.sql.exec(`SELECT COUNT(*) as count FROM messages`).one()
  const localCount = (result?.count as number) || 0

  if (localCount > 0) return localCount

  const sessionId = await host.getSessionIdForD1()
  if (!sessionId) return 0

  try {
    const d1Result = await host.getEnv().DB.prepare(`SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?`)
      .bind(sessionId)
      .first<{ count: number }>()
    return d1Result?.count || 0
  } catch (e) {
    console.warn(`[SessionDO] Failed to get message count from D1: ${e}`)
  }

  return 0
}
