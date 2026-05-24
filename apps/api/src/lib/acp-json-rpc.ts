/**
 * Worker-side WebSocket envelopes + JSON-RPC multiplexing for `ship-acp-bridge`.
 *
 * @remarks
 * The bridge wraps each agent stdio line as `{ type: 'rpc_in', line }`. Agent-initiated
 * permission RPCs default to **`allow-once`** so unattended sandboxes keep making progress.
 *
 * @packageDocumentation
 */

import {
  handleBridgeEnvelope,
  type JsonRpcRecord,
  type RpcPendingWaiter,
} from './acp-json-rpc-route'

export type { JsonRpcRecord } from './acp-json-rpc-route'

/** Send a bridge control message (`spawn` or `reset`). */
export function sendCtl(ws: WebSocket, op: 'spawn' | 'reset', backend?: string, model?: string): void {
  ws.send(JSON.stringify({ type: 'ctl', op, ...(backend ? { backend } : {}), ...(model ? { model } : {}) }))
}

/** JSON-RPC multiplexer over a bridge WebSocket. */
export interface AcpMultiplexer {
  request(method: string, params?: unknown, options?: { timeoutMs?: number }): Promise<unknown>
  notify(method: string, params?: unknown): void
  close(): void
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000

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
  const pending = new Map<string, RpcPendingWaiter>()
  let counter = 0
  let closed = false
  let closedError: Error | null = null

  function rejectAll(error: Error): void {
    if (closed && pending.size === 0) return
    closed = true
    closedError = error
    for (const [id, waiter] of pending) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
      pending.delete(id)
    }
  }

  const onMessage = async (ev: MessageEvent) => {
    let outer: JsonRpcRecord
    try {
      outer = JSON.parse(ev.data as string) as JsonRpcRecord
    } catch {
      return
    }
    await handleBridgeEnvelope(ws, pending, outer, {
      onAgentNotification: handlers.onAgentNotification,
      onLog: handlers.onLog,
      rejectAll,
    })
  }

  ws.addEventListener('message', (ev) => void onMessage(ev))
  ws.addEventListener('close', () => rejectAll(new Error('ACP bridge WebSocket closed')))
  ws.addEventListener('error', () => rejectAll(new Error('ACP bridge WebSocket error')))

  return {
    request(method, params, options) {
      if (closed) return Promise.reject(closedError ?? new Error('ACP bridge is closed'))
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

/** Open a WebSocket to the bridge relay with a connect timeout. */
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
