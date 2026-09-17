/**
 * Helpers for Durable Object SQLite lookups that may return zero rows.
 *
 * @packageDocumentation
 */

/** Minimal cursor shape used by optional SQLite lookups. */
export interface SqlFirstCursor<T> {
  toArray(): T[]
}

/**
 * Return the first row from a SQLite cursor, or `null` when nothing matched.
 *
 * @remarks
 * `SqlStorageCursor.one()` throws when the result set is empty. Optional
 * lookups must use this helper instead of `.one()?.field`.
 */
export function firstSqlRow<T extends Record<string, SqlStorageValue>>(cursor: SqlFirstCursor<T>): T | null {
  return cursor.toArray()[0] ?? null
}
