/**
 * Effect service tags for the ambient Cloudflare Worker resources the API
 * depends on. These are the dependency-injection seams: production code provides
 * the real D1 binding / OAuth config, while tests provide in-memory fakes.
 *
 * @packageDocumentation
 */

import { Context } from 'effect'
import type { Env } from '../env.d'

/** The D1 database binding, exposed as an injectable Effect service. */
export class Database extends Context.Tag('Database')<Database, D1Database>() {}

/** The complete Cloudflare Worker environment for this request or object. */
export class WorkerEnv extends Context.Tag('WorkerEnv')<WorkerEnv, Env>() {}

/** Minimal fetch surface used by Effect services that call HTTP endpoints. */
export interface FetchHttpClientService {
  readonly fetch: typeof fetch
}

/** Injectable HTTP client. Defaults to the platform `fetch` at the edge. */
export class FetchHttpClient extends Context.Tag('FetchHttpClient')<
  FetchHttpClient,
  FetchHttpClientService
>() {}

/** Live HTTP client service backed by global `fetch`. */
export const FetchHttpClientLive = FetchHttpClient.of({ fetch })

/** Access to Session Durable Object namespaces. */
export interface SessionDurableObjectsService {
  readonly namespace: DurableObjectNamespace
}

/** Injectable Session Durable Object namespace. */
export class SessionDurableObjects extends Context.Tag('SessionDurableObjects')<
  SessionDurableObjects,
  SessionDurableObjectsService
>() {}

/** Minimal logger surface used by Effect services. */
export interface LoggerService {
  readonly debug: (message: string, ...args: unknown[]) => void
  readonly info: (message: string, ...args: unknown[]) => void
  readonly warn: (message: string, ...args: unknown[]) => void
  readonly error: (message: string, ...args: unknown[]) => void
}

/** Injectable logger service for boundary-safe diagnostics. */
export class Logger extends Context.Tag('Logger')<Logger, LoggerService>() {}

/** Live logger backed by the Worker console. */
export const LoggerLive = Logger.of({
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
})

/** Randomness required by services that mint ids or jitter. */
export interface RandomService {
  readonly randomUUID: () => string
  readonly random: () => number
}

/** Injectable randomness service. */
export class Random extends Context.Tag('Random')<Random, RandomService>() {}

/** Live randomness service backed by Web Crypto and Math.random. */
export const RandomLive = Random.of({
  randomUUID: () => crypto.randomUUID(),
  random: () => Math.random(),
})

/** GitHub OAuth client credentials needed to refresh access tokens. */
export interface GitHubOAuthConfig {
  readonly clientId?: string
  readonly clientSecret?: string
}

/** Injectable GitHub OAuth configuration. */
export class OAuthConfig extends Context.Tag('OAuthConfig')<OAuthConfig, GitHubOAuthConfig>() {}
