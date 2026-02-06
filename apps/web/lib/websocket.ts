/**
 * Reconnecting WebSocket client
 *
 * Features:
 * - Auto-reconnect with exponential backoff and jitter
 * - Status tracking for UI feedback
 * - Clean disconnect handling
 *
 * Used for real-time session updates between client and SessionDO.
 */

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected'

export interface WebSocketOptions {
  /** WebSocket URL to connect to */
  url: string
  /** Callback for incoming messages (already parsed from JSON) */
  onMessage: (data: unknown) => void
  /** Optional callback for status changes */
  onStatusChange?: (status: WebSocketStatus) => void
}

export interface ReconnectingWebSocket {
  /** Send a message (will be JSON stringified) */
  send: (data: unknown) => void
  /** Disconnect and stop reconnecting */
  disconnect: () => void
  /** Get current connection status */
  getStatus: () => WebSocketStatus
}

/**
 * Create a reconnecting WebSocket connection
 *
 * @example
 * ```typescript
 * const ws = createReconnectingWebSocket({
 *   url: 'wss://api.example.com/sessions/123/websocket',
 *   onMessage: (data) => console.log('Received:', data),
 *   onStatusChange: (status) => setConnectionStatus(status),
 * });
 *
 * // Send message
 * ws.send({ type: 'ping' });
 *
 * // Clean up
 * ws.disconnect();
 * ```
 */
export function createReconnectingWebSocket(options: WebSocketOptions): ReconnectingWebSocket {
  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let status: WebSocketStatus = 'disconnected'
  let shouldReconnect = true
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  // Reconnection settings
  const maxAttempts = 10
  const baseDelay = 1000 // 1 second
  const maxDelay = 30000 // 30 seconds

  function setStatus(newStatus: WebSocketStatus): void {
    status = newStatus
    options.onStatusChange?.(newStatus)
  }

  function connect(): void {
    if (!shouldReconnect) return

    setStatus('connecting')

    try {
      ws = new WebSocket(options.url)
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      scheduleReconnect()
      return
    }

    ws.onopen = (): void => {
      reconnectAttempts = 0
      setStatus('connected')
    }

    ws.onmessage = (event: MessageEvent): void => {
      try {
        const data = JSON.parse(event.data)
        options.onMessage(data)
      } catch {
        console.error('Failed to parse WebSocket message:', event.data)
      }
    }

    ws.onclose = (event: CloseEvent): void => {
      setStatus('disconnected')
      ws = null

      // Don't reconnect on:
      // - 1000: Normal close
      // - 1005: No status received (server-side reset, e.g., DO code update)
      const shouldNotReconnect = event.code === 1000 || event.code === 1005

      if (shouldReconnect && !shouldNotReconnect) {
        scheduleReconnect()
      } else if (event.code === 1005) {
        console.warn('WebSocket closed with code 1005 (server reset), not reconnecting')
      }
    }

    ws.onerror = (): void => {
      // Error will trigger close, let close handler deal with reconnect
    }
  }

  function scheduleReconnect(): void {
    if (reconnectAttempts >= maxAttempts) {
      console.error('Max WebSocket reconnection attempts reached')
      return
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay)

    // Add jitter (0-50% of delay) to prevent thundering herd
    const jitter = delay * 0.5 * Math.random()

    reconnectTimeout = setTimeout(() => {
      reconnectAttempts++
      connect()
    }, delay + jitter)
  }

  function send(data: unknown): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }

  function disconnect(): void {
    shouldReconnect = false

    // Clear any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    // Close connection cleanly
    if (ws) {
      ws.close(1000, 'Client disconnected')
      ws = null
    }

    setStatus('disconnected')
  }

  function getStatus(): WebSocketStatus {
    return status
  }

  // Connect immediately
  connect()

  return { send, disconnect, getStatus }
}
