/**
 * OpenCode SDK wrapper for agent execution
 *
 * OpenCode provides the complete agent runtime:
 * - Build mode (execute immediately) and Plan mode (propose first)
 * - Tool execution (file ops, shell, code editing)
 * - SSE streaming with rich event types
 *
 * We do NOT make direct LLM calls - OpenCode handles everything.
 */

import { createOpencode, createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk'
import type { Event, Session, Part, TextPartInput } from '@opencode-ai/sdk'

// Re-export types for convenience
export type { Event, Session, Part, TextPartInput }

// Client instance cache
let clientInstance: OpencodeClient | null = null
let serverCleanup: (() => void) | null = null

/**
 * Get or create OpenCode client
 * In development, auto-starts the OpenCode server
 * In production, connects to existing server
 */
export async function getOpenCodeClient(): Promise<OpencodeClient> {
  if (clientInstance) {
    return clientInstance
  }

  // Check if we're in a Node.js environment (development)
  const globalProcess = (globalThis as { process?: { env?: Record<string, string> } }).process
  const isNode = typeof globalThis !== 'undefined' && globalProcess !== undefined

  // In Cloudflare Workers, ENVIRONMENT comes from bindings
  // In Node.js, check process.env
  const environment = isNode ? globalProcess?.env?.ENVIRONMENT : 'production'
  const isDev = environment === 'development'

  if (isDev) {
    // Auto-start server in development
    const { client, server } = await createOpencode({
      hostname: '127.0.0.1',
      port: 4096,
    })
    clientInstance = client
    serverCleanup = server.close
  } else {
    // Connect to existing server in production
    const host = isNode ? globalProcess?.env?.OPENCODE_HOST : undefined
    const port = isNode ? globalProcess?.env?.OPENCODE_PORT : undefined

    clientInstance = createOpencodeClient({
      baseUrl: `http://${host || '127.0.0.1'}:${port || '4096'}`,
    })
  }

  if (!clientInstance) {
    throw new Error('Failed to initialize OpenCode client')
  }

  return clientInstance
}

/**
 * Create a new OpenCode session for a project
 */
export async function createOpenCodeSession(projectPath: string): Promise<{ id: string; projectPath: string }> {
  const client = await getOpenCodeClient()
  const response = await client.session.create({
    query: { directory: projectPath },
  })

  if (response.error) {
    throw new Error(`Failed to create session: ${JSON.stringify(response.error)}`)
  }

  const session = response.data as Session
  return {
    id: session.id,
    projectPath,
  }
}

/**
 * Send a prompt to OpenCode session
 * This initiates the prompt and returns the response
 * For streaming events, use subscribeToEvents()
 */
export async function promptOpenCode(
  sessionId: string,
  content: string,
  _options?: { mode?: 'build' | 'plan' },
): Promise<void> {
  const client = await getOpenCodeClient()

  const textPart: TextPartInput = {
    type: 'text',
    text: content,
  }

  const response = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [textPart],
    },
  })

  if (response.error) {
    throw new Error(`Failed to send prompt: ${JSON.stringify(response.error)}`)
  }
}

/**
 * Subscribe to OpenCode global events
 * Returns an async iterator of events
 */
export async function subscribeToEvents(): Promise<AsyncIterable<Event>> {
  const client = await getOpenCodeClient()
  const eventStream = await client.global.event()

  // The SDK returns a ServerSentEventsResult which is async iterable
  return eventStream as unknown as AsyncIterable<Event>
}

/**
 * Stop/abort the current OpenCode session activity
 */
export async function stopOpenCode(sessionId: string): Promise<void> {
  const client = await getOpenCodeClient()
  await client.session.abort({
    path: { id: sessionId },
  })
}

/**
 * Respond to permission request
 * Note: This would be implemented via the permission.replied event
 */
export async function respondToPermission(
  _sessionId: string,
  _permissionId: string,
  _approved: boolean,
): Promise<void> {
  // Permission handling is done through the SDK's event system
  // Client should respond via WebSocket, and we forward to OpenCode
  // This is a placeholder for the full implementation
  throw new Error('Permission response not yet implemented')
}

/**
 * Cleanup OpenCode client and server
 */
export function cleanupOpenCode(): void {
  if (serverCleanup) {
    serverCleanup()
    serverCleanup = null
  }
  clientInstance = null
}

/**
 * Filter events for a specific session
 */
export async function* filterSessionEvents(
  eventStream: AsyncIterable<Event>,
  sessionId: string,
): AsyncGenerator<Event> {
  for await (const event of eventStream) {
    // Check if event belongs to this session
    const eventSessionId = getEventSessionId(event)
    if (eventSessionId && eventSessionId !== sessionId) {
      continue
    }

    yield event

    // Stop when session becomes idle or errors
    if (event.type === 'session.idle' || event.type === 'session.error') {
      break
    }
  }
}

/**
 * Extract session ID from event
 */
function getEventSessionId(event: Event): string | undefined {
  switch (event.type) {
    case 'message.part.updated':
      return event.properties.part.sessionID
    case 'message.part.removed':
      return event.properties.sessionID
    case 'permission.updated':
    case 'permission.replied':
      return event.properties.sessionID
    case 'session.status':
    case 'session.idle':
    case 'session.compacted':
      return event.properties.sessionID
    case 'session.created':
    case 'session.updated':
    case 'session.deleted':
      return event.properties.info.id
    case 'session.error':
      return event.properties.sessionID
    case 'session.diff':
      return event.properties.sessionID
    case 'todo.updated':
      return event.properties.sessionID
    case 'command.executed':
      return event.properties.sessionID
    default:
      return undefined
  }
}
