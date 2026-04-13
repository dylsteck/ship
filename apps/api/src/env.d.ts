/**
 * Cloudflare Worker Environment Bindings
 *
 * This file provides TypeScript types for environment variables and bindings
 * available in Cloudflare Workers runtime.
 */

import type { SessionDO } from './durable-objects/session';

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

  // Optional agent API keys
  OPENAI_API_KEY?: string;

  /** GitHub OAuth app credentials — used to refresh user access tokens for private repo clone/git */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  // Bankr LLM Gateway (optional, enables Bankr-powered models)
  // Get from: https://bankr.bot/api
  BANKR_API_KEY?: string;

  // Login restriction (optional)
  LOGIN_RESTRICTED_TO_SINGLE_USER?: string;
  ALLOWED_USER_ID?: string;
}
