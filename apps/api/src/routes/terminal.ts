/**
 * Terminal WebSocket proxy route
 *
 * Proxies browser WebSocket <-> E2B sandbox PTY terminal.
 * Client sends JSON messages: { type: 'input', data: string } and { type: 'resize', cols, rows }
 * Server sends raw terminal output as text frames.
 */

import { Hono } from 'hono'
import { Sandbox } from '@e2b/code-interpreter'
import type { Env } from '../env.d'

const terminal = new Hono<{ Bindings: Env }>()

/**
 * GET /terminal/:sessionId
 * Upgrades to WebSocket and bridges to E2B sandbox PTY.
 */
terminal.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')

  if (!sessionId) {
    return c.json({ error: 'sessionId is required' }, 400)
  }

  const upgradeHeader = c.req.header('Upgrade')
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426)
  }

  const doId = c.env.SESSION_DO.idFromName(sessionId)
  const doStub = c.env.SESSION_DO.get(doId)

  let sandboxId: string | null = null
  try {
    const sandboxResponse = await doStub.fetch('http://do/sandbox/status')
    if (!sandboxResponse.ok) {
      return c.json({ error: 'No sandbox found for session' }, 404)
    }
    const sandboxStatus = (await sandboxResponse.json()) as {
      sandboxId: string | null
      status: string | null
    }
    sandboxId = sandboxStatus.sandboxId
  } catch {
    return c.json({ error: 'Failed to get sandbox status' }, 500)
  }

  if (!sandboxId) {
    return c.json({ error: 'Session has no sandbox' }, 404)
  }

  const webSocketPair = new WebSocketPair()
  const [client, server] = [webSocketPair[0], webSocketPair[1]]

  server.accept()

  const apiKey = c.env.E2B_API_KEY

  ;(async () => {
    let sandbox: InstanceType<typeof Sandbox> | null = null
    let ptyPid: number | null = null

    try {
      sandbox = await Sandbox.connect(sandboxId!, {
        apiKey,
        timeoutMs: 5 * 60 * 1000,
      })

      const pty = await sandbox.pty.create({
        cols: 80,
        rows: 24,
        onData: (data: Uint8Array) => {
          try {
            if (server.readyState === WebSocket.OPEN) {
              server.send(new TextDecoder().decode(data))
            }
          } catch {
            // Client may have disconnected
          }
        },
        timeoutMs: 0,
        cwd: '/home/user/repo',
      })

      ptyPid = pty.pid

      server.addEventListener('message', async (event) => {
        try {
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : '')

          if (msg.type === 'input' && typeof msg.data === 'string' && sandbox) {
            await sandbox.pty.sendInput(ptyPid!, new TextEncoder().encode(msg.data))
          }

          if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number' && sandbox) {
            await sandbox.pty.resize(ptyPid!, { cols: msg.cols, rows: msg.rows })
          }
        } catch {
          // Ignore malformed messages
        }
      })

      server.addEventListener('close', () => {
        if (sandbox && ptyPid !== null) {
          sandbox.pty.kill(ptyPid).catch(() => {})
        }
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Terminal connection failed'
      try {
        server.send(JSON.stringify({ type: 'error', message: msg }))
        server.close(1011, msg)
      } catch {
        // Already closed
      }
    }
  })()

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
})

export default terminal
