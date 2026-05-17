/**
 * Resolve the API base URL for the current environment.
 *
 * Priority order:
 *   1. `NEXT_PUBLIC_API_URL` — explicit override (recommended in
 *      preview/dev/production deploys via Vercel/Coolify env config).
 *   2. `API_BASE_URL` — server-side override.
 *   3. `http://localhost:8787` — sensible default for `pnpm dev`
 *      (matches `wrangler dev`'s default port).
 *
 * Production deployments **must** set `NEXT_PUBLIC_API_URL`; the localhost
 * fallback is intentional only for local + agent-driven testing.
 *
 * @packageDocumentation
 */

const LOCAL_API_URL = 'http://localhost:8787'

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  LOCAL_API_URL
).trim()
