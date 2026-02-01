# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**GitHub:**
- GitHub API v3 - Repository access, user authentication, pull requests
  - SDK/Client: `@octokit/rest` 22.0.1
  - Auth: OAuth2 via GitHub OAuth app
  - Env vars: `NEXT_PUBLIC_GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - Usage locations: `lib/sandbox/port-detection.ts`, `app/api/repos/route.ts`, `app/api/repos/[owner]/[repo]/[type]/route.ts`
  - Scopes: Repository access, user profile, possibly pull request creation

**Vercel:**
- Vercel Sandbox API - Isolated code execution environment for running agent tasks
  - SDK/Client: `@vercel/sandbox` 0.0.21
  - Auth: Bearer token (Vercel API token)
  - Env vars: `SANDBOX_VERCEL_TOKEN`, `SANDBOX_VERCEL_TEAM_ID`, `SANDBOX_VERCEL_PROJECT_ID`
  - Usage: `lib/sandbox/creation.ts`, `lib/sandbox/commands.ts`
  - Features: Runtime isolation, command execution, port detection, resource allocation

**Vercel Analytics & Monitoring:**
- Vercel Web Analytics - Analytics tracking
  - SDK/Client: `@vercel/analytics` 1.6.1
- Vercel Speed Insights - Performance monitoring
  - SDK/Client: `@vercel/speed-insights` 1.3.1

## Data Storage

**Databases:**
- PostgreSQL via Neon (serverless, connection pooling)
  - Connection: `POSTGRES_URL` environment variable
  - Client: `postgres` driver with `@neondatabase/serverless` adapter
  - ORM: Drizzle ORM 0.36.4
  - Location: `lib/db/client.ts`, `lib/db/schema.ts`
  - Migrations: `drizzle-kit` with migrations in `lib/db/migrations/`
  - Schema file: `lib/db/schema.ts`

**File Storage:**
- Local filesystem in Vercel Sandbox environment
  - Project directory: `/vercel/sandbox/project`
  - Used for cloned repositories and temporary files during agent execution

**Caching:**
- In-memory session management
- Client-side state via Jotai atom store
- None detected for distributed caching (Redis, Memcached)

## Authentication & Identity

**Auth Provider:**
- GitHub OAuth 2.0 (primary)
  - Implementation: Custom OAuth flow with signed state cookies
  - Token exchange endpoint: `https://github.com/login/oauth/access_token`
  - User info endpoint: `https://api.github.com/user`
  - Location: `app/api/auth/github/callback/route.ts`, `lib/session/create-github.ts`

- Vercel OAuth (secondary option in schema)
  - Defined in schema but implementation status unclear
  - Provider field in users table accepts both 'github' and 'vercel'

**Token Management:**
- JWT/JWE for session tokens
  - Library: `jose` 6.1.3
  - Secret: `JWE_SECRET` environment variable
- OAuth tokens encrypted with `ENCRYPTION_KEY` before database storage
- Crypto location: `lib/crypto.ts` (referenced in callback route)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Server-side console logging (console.log, console.error)
- Client-side task logging via `TaskLogger` class
  - Location: `lib/utils/task-logger.ts`
  - Logs stored in `tasks.logs` JSONB column in database
  - Log entry types: 'info', 'command', 'error', 'success'
- Sensitive information redacted via `redactSensitiveInfo()` function
  - Location: `lib/utils/logging.ts`
  - Redacts GitHub tokens, Vercel tokens, API keys, team IDs, project IDs

## CI/CD & Deployment

**Hosting:**
- Vercel (primary)
  - Next.js deployment target
  - Sandbox environment for code execution

**CI Pipeline:**
- Not detected in package.json
- Likely using Vercel's built-in deployment pipeline (Git-based)

## Environment Configuration

**Required env vars:**
**Critical:**
- `POSTGRES_URL` - Database connection (Neon PostgreSQL)
- `JWE_SECRET` - JWT encryption secret (256-bit hex)
- `ENCRYPTION_KEY` - Token encryption key (256-bit hex)
- `NEXT_PUBLIC_GITHUB_CLIENT_ID` - GitHub OAuth app ID (public)
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
- `SANDBOX_VERCEL_TOKEN` - Vercel API access token
- `SANDBOX_VERCEL_TEAM_ID` - Vercel team ID
- `SANDBOX_VERCEL_PROJECT_ID` - Vercel project ID for sandbox

**Optional (User-Provided):**
- `ANTHROPIC_API_KEY` - Claude/Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key
- `CURSOR_API_KEY` - Cursor IDE API key
- `GEMINI_API_KEY` - Google Gemini API key
- `AI_GATEWAY_API_KEY` - Anthropic AI Gateway key (alternative to ANTHROPIC_API_KEY)

**Limits:**
- `MAX_SANDBOX_DURATION` - Maximum sandbox execution time in seconds (default: 300)
- `MAX_MESSAGES_PER_DAY` - Rate limiting for API messages (default: 50)

**Secrets location:**
- `.env.local` file (development, not committed)
- Environment variables (production on Vercel)

## Webhooks & Callbacks

**Incoming:**
- GitHub OAuth callback: `GET /api/auth/github/callback`
  - Handles OAuth code exchange and user authentication
  - Creates or links GitHub accounts

**Outgoing:**
- GitHub API calls:
  - Repository listing: `GET /user/repos`
  - Repository content: `GET /repos/{owner}/{repo}/contents/{path}`
  - Pull request operations (inferred from schema but endpoint not found)
- Vercel Sandbox API calls:
  - Sandbox creation
  - Command execution
  - Status monitoring

## Agent Integration

**Supported Agents:**
1. **Claude** - Anthropic's Claude AI
   - CLI: `@anthropic-ai/claude-code`
   - Entry: `lib/sandbox/agents/claude.ts`
   - API Key: `ANTHROPIC_API_KEY` or `AI_GATEWAY_API_KEY`

2. **OpenAI/Codex** - OpenAI API
   - CLI: OpenCode/Codex
   - Entry: `lib/sandbox/agents/codex.ts`
   - API Key: `OPENAI_API_KEY`

3. **GitHub Copilot** - GitHub's code AI
   - CLI: `@githubnext/ghcp`
   - Entry: `lib/sandbox/agents/copilot.ts`

4. **Cursor** - Cursor IDE's AI
   - CLI: `@anthropic-ai/cursor-code`
   - Entry: `lib/sandbox/agents/cursor.ts`
   - API Key: `CURSOR_API_KEY`

5. **Gemini** - Google's Gemini AI
   - Entry: `lib/sandbox/agents/gemini.ts`
   - API Key: `GEMINI_API_KEY`

6. **OpenCode** - OpenCode framework
   - Entry: `lib/sandbox/agents/opencode.ts`
   - Used for code generation and execution

**MCP (Model Context Protocol) Servers:**
- Configurable custom connectors for agents
- Schema: `lib/db/schema.ts` - `connectors` table
- Supports local and remote MCP servers
- Connection types: local command or remote HTTP endpoint

## Data Models

**Core Tables:**
- `users` - User authentication (GitHub/Vercel OAuth)
- `accounts` - Linked GitHub accounts to users
- `keys` - User-stored API keys for agents (encrypted storage)
  - Providers: anthropic, openai, cursor, gemini, aigateway
- `tasks` - Agent execution tasks with sandbox tracking
- `taskMessages` - Chat history for tasks
- `connectors` - MCP server configurations
- `settings` - User preferences key-value storage

---

*Integration audit: 2026-02-01*
