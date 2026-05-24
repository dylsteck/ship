/** Session id currently owning the tab-local POST /chat SSE stream (skip duplicate WS agent-events). */
let activeSseSessionId: string | null = null

export function setActiveSseSession(sessionId: string | null): void {
  activeSseSessionId = sessionId
}

export function isActiveSseSession(sessionId: string): boolean {
  return activeSseSessionId === sessionId
}
