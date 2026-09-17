/**
 * Idempotent SQLite migrations for SessionDO.
 *
 * @packageDocumentation
 */

interface ColumnRow extends Record<string, SqlStorageValue> {
  name: string
}

function hasColumn(sql: SqlStorage, table: string, column: string): boolean {
  return sql.exec<ColumnRow>(`PRAGMA table_info(${table})`).toArray().some((row) => row.name === column)
}

function addColumn(sql: SqlStorage, table: string, column: string, declaration: string): void {
  if (!hasColumn(sql, table, column)) {
    sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`)
  }
}

/** Apply every SessionDO schema migration in order. */
export function migrateSessionSchema(sql: SqlStorage): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
      id INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      turn_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      parts TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      mode TEXT DEFAULT 'build',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS session_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      client_command_id TEXT,
      mode TEXT NOT NULL DEFAULT 'agent',
      model_id TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL,
      diff_summary TEXT,
      workflow_instance_id TEXT,
      attempt_id TEXT,
      execution_state TEXT NOT NULL DEFAULT 'accepted',
      prompt_sent INTEGER NOT NULL DEFAULT 0,
      heartbeat_at INTEGER,
      stop_requested INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT,
      turn_id TEXT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_turn_state (
      turn_id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      parts TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tool_outputs (
      tool_call_id TEXT PRIMARY KEY,
      turn_id TEXT,
      output TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  addColumn(sql, 'messages', 'turn_id', 'TEXT')
  addColumn(sql, 'turns', 'client_command_id', 'TEXT')
  addColumn(sql, 'turns', 'mode', "TEXT NOT NULL DEFAULT 'agent'")
  addColumn(sql, 'turns', 'model_id', 'TEXT')
  addColumn(sql, 'turns', 'workflow_instance_id', 'TEXT')
  addColumn(sql, 'turns', 'attempt_id', 'TEXT')
  addColumn(sql, 'turns', 'execution_state', "TEXT NOT NULL DEFAULT 'accepted'")
  addColumn(sql, 'turns', 'prompt_sent', 'INTEGER NOT NULL DEFAULT 0')
  addColumn(sql, 'turns', 'heartbeat_at', 'INTEGER')
  addColumn(sql, 'turns', 'stop_requested', 'INTEGER NOT NULL DEFAULT 0')
  addColumn(sql, 'session_events', 'event_id', 'TEXT')
  addColumn(sql, 'session_events', 'turn_id', 'TEXT')

  sql.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_created_id ON messages(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_turn ON messages(turn_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, started_at DESC, id DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_client_command ON turns(client_command_id) WHERE client_command_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_turns_execution ON turns(execution_state, heartbeat_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_session_events_event_id ON session_events(event_id) WHERE event_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_session_events_sequence ON session_events(sequence);
    CREATE INDEX IF NOT EXISTS idx_session_events_turn ON session_events(turn_id, sequence);
    INSERT OR IGNORE INTO _sql_schema_migrations (id, applied_at) VALUES (1, ${Date.now()});
    INSERT OR IGNORE INTO _sql_schema_migrations (id, applied_at) VALUES (2, ${Date.now()});
  `)
}
