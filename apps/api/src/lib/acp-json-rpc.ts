/**
 * Worker-side WebSocket envelopes + JSON-RPC multiplexing for `ship-acp-bridge`.
 *
 * @remarks
 * The bridge wraps each agent stdio line as `{ type: 'rpc_in', line }`. Agent-initiated
 * permission RPCs default to **`allow-once`** so unattended sandboxes keep making progress.
 *
 * @packageDocumentation
 */

export type JsonRpcRecord = Record<string, unknown>

export function sendCtl(ws: WebSocket, op: 'spawn' | 'reset', backend?: string): void {
  ws.send(JSON.stringify({ type: 'ctl', op, ...(backend ? { backend } : {}) }))
}

export interface AcpMultiplexer {
  request(method: string, params?: unknown, options?: { timeoutMs?: number }): Promise<unknown>
  notify(method: string, params?: unknown): void
  close(): void
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000

function errorFromUnknown(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  return new Error(JSON.stringify(value))
}

/**
 * Bridge envelopes carry NDJSON agent traffic as `{ type:'rpc_in', line:string }`.
 * Handles JSON-RPC responses, agent→client requests (permissions), and notifications.
 */
export function createAcpMultiplexer(
  ws: WebSocket,
  handlers: {
    onAgentNotification: (msg: JsonRpcRecord) => void | Promise<void>
    onLog?: (stream: string, data: string) => void
  },
): AcpMultiplexer {
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  let counter = 0
  let closed = false

  function rejectAll(error: Error): void {
    if (closed && pending.size === 0) return
    closed = true
    for (const [id, waiter] of pending) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
      pending.delete(id)
    }
  }

  const route = async (rawLine: string) => {
    let rpc: JsonRpcRecord
    try {
      rpc = JSON.parse(rawLine) as JsonRpcRecord
    } catch {
      return
    }

    const id = rpc.id
    const method = typeof rpc.method === 'string' ? rpc.method : undefined

    if (id !== undefined && id !== null && ('result' in rpc || 'error' in rpc)) {
      const idStr = String(id)
      const waiter = pending.get(idStr)
      if (waiter) {
        pending.delete(idStr)
        clearTimeout(waiter.timer)
        if (rpc.error) waiter.reject(errorFromUnknown(rpc.error))
        else waiter.resolve(rpc.result)
        return
      }
    }

    if (method && id !== undefined && id !== null && !('result' in rpc) && !('error' in rpc)) {
      if (method.includes('permission') || method.endsWith('request_permission')) {
        reply(id, { decision: 'allow-once', status: 'approved' })
        return
      }
      if (method.includes('ask_question') || method.includes('create_plan')) {
        reply(id, { acknowledged: true, auto: true })
        return
      }
      reply(id, { acknowledged: true })
      return
    }

    if (method && (id === undefined || id === null)) {
      await handlers.onAgentNotification(rpc)
    }
  }

  function reply(reqId: unknown, result: unknown): void {
    ws.send(
      JSON.stringify({
        type: 'rpc_out',
        line: JSON.stringify({ jsonrpc: '2.0', id: reqId, result }),
      }),
    )
  }

  const onMessage = async (ev: MessageEvent) => {
    let outer: JsonRpcRecord
    try {
      outer = JSON.parse(ev.data as string) as JsonRpcRecord
    } catch {
      return
    }
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
      rejectAll(new Error(message))
      return
    }
    if (outer.type === 'rpc_in' && typeof outer.line === 'string') {
      await route(outer.line)
    }
  }

  ws.addEventListener('message', (ev) => void onMessage(ev))
  ws.addEventListener('close', () => rejectAll(new Error('ACP bridge WebSocket closed')))
  ws.addEventListener('error', () => rejectAll(new Error('ACP bridge WebSocket error')))

  return {
    request(method, params, options) {
      if (closed) return Promise.reject(new Error('ACP bridge is closed'))
      const rid = String(++counter)
      ws.send(
        JSON.stringify({
          type: 'rpc_out',
          line: JSON.stringify({ jsonrpc: '2.0', id: rid, method, params }),
        }),
      )
      return new Promise((resolve, reject) => {
        const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
        const timer = setTimeout(() => {
          pending.delete(rid)
          reject(new Error(`ACP request timed out: ${method}`))
        }, timeoutMs)
        pending.set(rid, { resolve, reject, timer })
      })
    },
    notify(method, params) {
      ws.send(
        JSON.stringify({
          type: 'rpc_out',
          line: JSON.stringify({ jsonrpc: '2.0', method, params }),
        }),
      )
    },
    close() {
      rejectAll(new Error('ACP bridge closed by client'))
      ws.close()
    },
  }
}

export function openBridgeWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error('ACP bridge WebSocket connect timeout')), 30_000)
    ws.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        resolve(ws)
      },
      { once: true },
    )
    ws.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        reject(new Error('ACP bridge WebSocket failed'))
      },
      { once: true },
    )
  })
}
