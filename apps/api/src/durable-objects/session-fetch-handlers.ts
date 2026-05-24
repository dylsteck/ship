import type { SessionFetchHost } from './session-fetch-host'
import {
  handleSessionAgentRoutes,
  handleSessionDataRoutes,
  handleSessionSandboxRoutes,
} from './session-fetch-routes'

/**
 * Dispatch HTTP fetch requests to SessionDO RPC endpoints.
 *
 * @param host - Session DO instance
 * @param request - Incoming fetch request
 */
export async function handleSessionFetch(host: SessionFetchHost, request: Request): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname.endsWith('/websocket')) {
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }
    return host.handleWebSocketUpgrade(request)
  }

  if (url.pathname.endsWith('/health')) {
    return Response.json({
      status: 'ok',
      tables: ['messages', 'tasks', 'session_meta', 'turns', 'session_events'],
      connections: host.getWebSocketCount(),
    })
  }

  for (const handler of [handleSessionDataRoutes, handleSessionSandboxRoutes, handleSessionAgentRoutes]) {
    const response = await handler(host, url, request)
    if (response) return response
  }

  return new Response('Not found', { status: 404 })
}

export type { SessionFetchHost } from './session-fetch-host'
