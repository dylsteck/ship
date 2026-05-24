/**
 * JSON-RPC line routing for ACP bridge WebSocket envelopes.
 *
 * @packageDocumentation
 */

export type JsonRpcRecord = Record<string, unknown>

export function errorFromUnknown(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  return new Error(JSON.stringify(value))
}

/** Send a JSON-RPC result back to the agent via the bridge. */
export function sendRpcReply(ws: WebSocket, reqId: unknown, result: unknown): void {
  ws.send(
    JSON.stringify({
      type: 'rpc_out',
      line: JSON.stringify({ jsonrpc: '2.0', id: reqId, result }),
    }),
  )
}

export interface RpcPendingWaiter {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** Resolve a pending JSON-RPC response by request id. */
export function resolvePendingResponse(
  pending: Map<string, RpcPendingWaiter>,
  rpc: JsonRpcRecord,
): boolean {
  const id = rpc.id
  if (id === undefined || id === null || !('result' in rpc || 'error' in rpc)) {
    return false
  }

  const idStr = String(id)
  const waiter = pending.get(idStr)
  if (!waiter) return false

  pending.delete(idStr)
  clearTimeout(waiter.timer)
  if (rpc.error) waiter.reject(errorFromUnknown(rpc.error))
  else waiter.resolve(rpc.result)
  return true
}

/** Handle agent-initiated JSON-RPC requests (permissions, questions). */
export function handleAgentRequest(ws: WebSocket, rpc: JsonRpcRecord): boolean {
  const id = rpc.id
  const method = typeof rpc.method === 'string' ? rpc.method : undefined
  if (!method || id === undefined || id === null || 'result' in rpc || 'error' in rpc) {
    return false
  }

  if (method.includes('permission') || method.endsWith('request_permission')) {
    sendRpcReply(ws, id, {
      decision: 'allow-once',
      status: 'approved',
      outcome: { outcome: 'selected', optionId: 'allow-once' },
    })
    return true
  }
  if (method.includes('ask_question')) {
    sendRpcReply(ws, id, { acknowledged: true, auto: true, outcome: { outcome: 'skipped', reason: 'auto' } })
    return true
  }
  if (method.includes('create_plan')) {
    sendRpcReply(ws, id, { acknowledged: true, auto: true, outcome: { outcome: 'accepted' } })
    return true
  }
  sendRpcReply(ws, id, { acknowledged: true })
  return true
}

/** Parse and route one NDJSON RPC line from the bridge. */
export async function routeRpcLine(
  ws: WebSocket,
  pending: Map<string, RpcPendingWaiter>,
  rawLine: string,
  onAgentNotification: (msg: JsonRpcRecord) => void | Promise<void>,
): Promise<void> {
  let rpc: JsonRpcRecord
  try {
    rpc = JSON.parse(rawLine) as JsonRpcRecord
  } catch {
    return
  }

  if (resolvePendingResponse(pending, rpc)) return
  if (handleAgentRequest(ws, rpc)) return

  const method = typeof rpc.method === 'string' ? rpc.method : undefined
  const id = rpc.id
  if (method && (id === undefined || id === null)) {
    await onAgentNotification(rpc)
  }
}

/** Handle one bridge WebSocket envelope (`log`, `ctl`, `rpc_in`). */
export async function handleBridgeEnvelope(
  ws: WebSocket,
  pending: Map<string, RpcPendingWaiter>,
  outer: JsonRpcRecord,
  handlers: {
    onAgentNotification: (msg: JsonRpcRecord) => void | Promise<void>
    onLog?: (stream: string, data: string) => void
    rejectAll: (error: Error) => void
  },
): Promise<void> {
  if (outer.type === 'log' && typeof outer.data === 'string') {
    handlers.onLog?.(typeof outer.stream === 'string' ? outer.stream : 'stderr', outer.data)
    return
  }

  if (outer.type === 'ctl' && (outer.status === 'error' || outer.status === 'exit')) {
    const message =
      typeof outer.message === 'string'
        ? outer.message
        : outer.status === 'exit'
          ? `ACP backend exited before completing the request`
          : 'ACP backend failed'
    handlers.rejectAll(new Error(message))
    return
  }

  if (outer.type === 'rpc_in' && typeof outer.line === 'string') {
    await routeRpcLine(ws, pending, outer.line, handlers.onAgentNotification)
  }
}
