/**
 * Web bootstrap for `@ship/sdk` — call from RSC and client on mount.
 */

import { API_URL } from '@/lib/config'
import { configureShipClient } from '@ship/sdk'

let tokenGetter: (() => string | null | Promise<string | null>) | null = null

/** Store JWT for browser SDK calls (from RSC props). */
export function setApiToken(token: string): void {
  tokenGetter = () => token
  configureShipClient({ baseUrl: API_URL, getAuthToken: tokenGetter })
}

/** Read current browser JWT (WebSocket URLs). */
export function getApiToken(): string | null {
  const t = tokenGetter?.()
  return t instanceof Promise ? null : (t ?? null)
}

/**
 * Configure SDK for SSR with cookie/session token getter.
 */
export function configureWebShipClient(getAuthToken: () => string | null | Promise<string | null>): void {
  tokenGetter = getAuthToken
  configureShipClient({ baseUrl: API_URL, getAuthToken })
}

export { API_URL } from '@/lib/config'
