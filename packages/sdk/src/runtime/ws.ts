/**
 * WebSocket URL builder for session sync and terminal tabs.
 */

/**
 * Build a WebSocket URL with JWT token query param (Workers WS auth pattern).
 */
export function buildWsUrl(baseUrl: string, path: string, token: string | null): string {
  const wsBase = baseUrl.replace(/^http/, 'ws')
  const url = new URL(path, wsBase)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
