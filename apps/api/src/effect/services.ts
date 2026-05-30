/**
 * Effect service tags for the ambient Cloudflare Worker resources the API
 * depends on. These are the dependency-injection seams: production code provides
 * the real D1 binding / OAuth config, while tests provide in-memory fakes.
 *
 * @packageDocumentation
 */

import { Context } from 'effect'

/** The D1 database binding, exposed as an injectable Effect service. */
export class Database extends Context.Tag('Database')<Database, D1Database>() {}

/** GitHub OAuth client credentials needed to refresh access tokens. */
export interface GitHubOAuthConfig {
  readonly clientId?: string
  readonly clientSecret?: string
}

/** Injectable GitHub OAuth configuration. */
export class OAuthConfig extends Context.Tag('OAuthConfig')<OAuthConfig, GitHubOAuthConfig>() {}
