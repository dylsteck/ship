/**
 * Migration helper for local development
 *
 * This script helps run migrations against the local D1 database.
 *
 * Usage:
 *   pnpm wrangler d1 execute ship-db --local --file=./src/db/schema.sql
 *
 * To verify tables were created:
 *   pnpm wrangler d1 execute ship-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"
 *
 * For production migrations, use:
 *   pnpm wrangler d1 execute ship-db --remote --file=./src/db/schema.sql
 */

export {}
