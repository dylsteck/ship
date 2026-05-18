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
  request(method: string, params?: unknown): Promise<unknown>
  notify(method: string, params?: unknown): void
  close(): void
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
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  let counter = 0

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
        if (rpc.error) waiter.reject(new Error(typeof rpc.error === 'string' ? rpc.error : JSON.stringify(rpc.error)))
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
    if (outer.type === 'rpc_in' && typeof outer.line === 'string') {
      await route(outer.line)
    }
  }

  ws.addEventListener('message', (ev) => void onMessage(ev))

  return {
    request(method, params) {
      const rid = String(++counter)
      ws.send(
        JSON.stringify({
          type: 'rpc_out',
          line: JSON.stringify({ jsonrpc: '2.0', id: rid, method, params }),
        }),
      )
      return new Promise((resolve, reject) => {
        pending.set(rid, { resolve, reject })
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
