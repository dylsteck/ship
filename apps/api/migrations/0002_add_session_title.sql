-- Add title column to chat_sessions for OpenCode session names
-- Run base schema first if chat_sessions doesn't exist: wrangler d1 execute <db> --file=src/db/schema.sql
--
-- Local (ship-db):  npx wrangler d1 execute ship-db --local --file=migrations/0002_add_session_title.sql
-- Prod (remote):   npx wrangler d1 execute ship-db-production --file=migrations/0002_add_session_title.sql --env production --remote

ALTER TABLE chat_sessions ADD COLUMN title TEXT;
