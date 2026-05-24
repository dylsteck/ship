/**
 * Ship SDK runtime — client configuration and error helpers.
 */

import { client } from '../generated/client.gen'

/** Options for configuring the global Ship API client. */
export interface ShipClientConfig {
  baseUrl: string
  /** Returns JWT (browser) or session cookie value (SSR). */
  getAuthToken: () => string | null | Promise<string | null>
}

let configured = false

/**
 * Configure the global `@ship/sdk` fetch client (call once at app bootstrap).
 */
export function configureShipClient(config: ShipClientConfig): void {
  client.setConfig({
    baseUrl: config.baseUrl,
    auth: async () => (await config.getAuthToken()) ?? undefined,
  })
  configured = true
}

/** Whether {@link configureShipClient} has been called. */
export function isShipClientConfigured(): boolean {
  return configured
}

/** Enriched error matching legacy `apps/web/lib/api/client` fetcher behavior. */
export interface ShipApiError extends Error {
  status?: number
  info?: unknown
  url?: string
}

/**
 * Map Hey API error payloads to throwable errors for SWR.
 */
export function toShipError(error: unknown, url?: string): ShipApiError {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const message =
      (typeof e.message === 'string' && e.message) ||
      (typeof e.error === 'string' && e.error) ||
      'Request failed'
    const err = new Error(message) as ShipApiError
    if (typeof e.status === 'number') err.status = e.status
    else if (typeof e.statusCode === 'number') err.status = e.statusCode
    err.info = e
    if (url) err.url = url
    return err
  }
  const err = new Error(String(error)) as ShipApiError
  if (url) err.url = url
  return err
}

/**
 * Unwrap `{ data, error }` from SDK calls — throws {@link ShipApiError} on failure.
 */
export function unwrapSdkData<T>(result: { data?: T; error?: unknown; response?: Response }): T {
  if (result.error) {
    throw toShipError(result.error, result.response?.url)
  }
  if (result.data === undefined) {
    throw toShipError({ message: 'Empty response' }, result.response?.url)
  }
  return result.data
}

export { client }
