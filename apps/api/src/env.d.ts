/**
 * Cloudflare Worker Environment Bindings
 *
 * This file provides TypeScript types for environment variables and bindings
 * available in Cloudflare Workers runtime.
 */

import type { SessionDO } from './durable-objects/session'

/** Minimal Workflow binding surface — Cloudflare injects concrete implementation */
interface Workflow {
  create(options?: { params?: unknown }): Promise<unknown>
}

export interface Env {
  // D1 Database binding
  DB: D1Database;

  // Durable Objects
  SESSION_DO: DurableObjectNamespace<SessionDO>;

  // Environment variables
  ENVIRONMENT: string;

  // Secrets (set via wrangler secret put or .dev.vars locally)
  ANTHROPIC_API_KEY: string;
  API_SECRET: string;
  SESSION_SECRET: string;
  E2B_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  VERCEL_PROJECT_NAME?: string;

  // Optional agent API keys / ACP backends (inject into sandbox env at runtime — single-tenant MVP)
  OPENAI_API_KEY?: string;
  /** Cursor CLI (`agent acp`) — pick one auth style */
  CURSOR_API_KEY?: string;
  CURSOR_AUTH_TOKEN?: string;
  /** OpenCode CLI (`opencode acp`) */
  OPENCODE_API_KEY?: string;

  /** GitHub OAuth app credentials — used to refresh user access tokens for private repo clone/git */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  /** Cloudflare Workflow — durable bootstrap scaffolding (optional trigger from handlers later) */
  SHIP_ACP_WORKFLOW?: Workflow;

  // Login restriction (optional)
  LOGIN_RESTRICTED_TO_SINGLE_USER?: string;
  ALLOWED_USER_ID?: string;
}
