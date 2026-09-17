-- Realtime v2 persistent session projection and turn association.

ALTER TABLE chat_sessions ADD COLUMN model TEXT;
ALTER TABLE chat_sessions ADD COLUMN agent_type TEXT;
ALTER TABLE chat_sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE chat_messages ADD COLUMN turn_id TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_status_activity
  ON chat_sessions(user_id, status, last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created_id
  ON chat_messages(session_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_turn
  ON chat_messages(session_id, turn_id, created_at, id);
