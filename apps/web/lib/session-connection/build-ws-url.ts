import { getApiToken } from '@/lib/api/configure'
import { API_URL } from '@/lib/config'

/** Build an authenticated WebSocket URL for a session. */
export function buildSessionWebSocketUrl(sessionId: string): string {
  const token = getApiToken()
  const base = `${API_URL.replace('http', 'ws')}/sessions/${encodeURIComponent(sessionId)}/websocket`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
