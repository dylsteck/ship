/**
 * OpenCode SDK wrapper for agent execution
 *
 * OpenCode provides the complete agent runtime:
 * - Build mode (execute immediately) and Plan mode (propose first)
 * - Tool execution (file ops, shell, code editing)
 * - SSE streaming with rich event types
 *
 * We do NOT make direct LLM calls - OpenCode handles everything.
 *
 * ARCHITECTURE NOTE:
 * In production, OpenCode runs INSIDE the E2B sandbox, not as a separate server.
 * The client connects to the sandbox's OpenCode server via sandbox.getHost(port).
 * In development, we auto-start a local OpenCode server.
 */

import { createOpencode, createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk'
import type { Event, Session, Part, TextPartInput } from '@opencode-ai/sdk'

// Re-export types for convenience
export type { Event, Session, Part, TextPartInput }

// Client instance cache for development mode only
let devClientInstance: OpencodeClient | null = null
let serverCleanup: (() => void) | null = null

// Cache of clients per sandbox URL (for production)
const sandboxClients: Map<string, OpencodeClient> = new Map()

/**
 * Create an OpenCode client for a specific sandbox
 * This is the primary method for production use in CF Workers
 *
 * @param baseUrl - The public URL of the OpenCode server in the sandbox
 * @returns OpencodeClient connected to the sandbox
 */
export function createOpenCodeClientForSandbox(baseUrl: string): OpencodeClient {
  // Check cache first
  const cached = sandboxClients.get(baseUrl)
  if (cached) {
    return cached
  }

  // Create new client
  const client = createOpencodeClient({ baseUrl })
  sandboxClients.set(baseUrl, client)
  return client
}

/**
 * Get or create OpenCode client for development
 * Auto-starts the OpenCode server locally
 *
 * WARNING: This should only be used in development mode!
 * In production, use createOpenCodeClientForSandbox() with the sandbox URL.
 */
export async function getOpenCodeClientDev(): Promise<OpencodeClient> {
  if (devClientInstance) {
    return devClientInstance
  }

  // Auto-start server in development
  // OpenCode will automatically load opencode.json from project root
  const { client, server } = await createOpencode({
    hostname: '127.0.0.1',
    port: 4096,
  })
  devClientInstance = client
  serverCleanup = server.close

  return devClientInstance
}

/**
 * Get or create OpenCode client
 * In development, auto-starts the OpenCode server
 * In production with sandbox URL, connects to sandbox's OpenCode server
 *
 * @param sandboxUrl - Optional URL for the sandbox's OpenCode server (required in production)
 */
export async function getOpenCodeClient(sandboxUrl?: string): Promise<OpencodeClient> {
  // Check if we're in a Node.js environment (development)
  const globalProcess = (globalThis as { process?: { env?: Record<string, string> } }).process
  const isNode = typeof globalThis !== 'undefined' && globalProcess !== undefined

  // In Cloudflare Workers, ENVIRONMENT comes from bindings
  // In Node.js, check process.env
  const environment = isNode ? globalProcess?.env?.ENVIRONMENT : 'production'
  const isDev = environment === 'development'

  if (isDev) {
    return getOpenCodeClientDev()
  }

  // Production mode - must have sandbox URL
  if (!sandboxUrl) {
    throw new Error(
      'OpenCode sandbox URL required in production. Ensure sandbox is provisioned and OpenCode server is started.',
    )
  }

  return createOpenCodeClientForSandbox(sandboxUrl)
}

/**
 * Create a new OpenCode session for a project
 *
 * @param projectPath - Path to the project in the sandbox
 * @param sandboxUrl - Optional URL for the sandbox's OpenCode server (required in production)
 */
export async function createOpenCodeSession(
  projectPath: string,
  sandboxUrl?: string,
): Promise<{ id: string; projectPath: string }> {
  const client = await getOpenCodeClient(sandboxUrl)
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
 *
 * @param sessionId - OpenCode session ID
 * @param content - Prompt content
 * @param options - Optional mode and model settings
 * @param sandboxUrl - Optional URL for the sandbox's OpenCode server (required in production)
 */
export async function promptOpenCode(
  sessionId: string,
  content: string,
  options?: { mode?: 'build' | 'plan'; model?: string },
  sandboxUrl?: string,
): Promise<void> {
  const client = await getOpenCodeClient(sandboxUrl)

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
 *
 * @param sandboxUrl - Optional URL for the sandbox's OpenCode server (required in production)
 */
export async function subscribeToEvents(sandboxUrl?: string): Promise<AsyncIterable<Event>> {
  const client = await getOpenCodeClient(sandboxUrl)
  console.log(`[opencode] Subscribing to events at ${sandboxUrl}...`)

  const eventStream = await client.global.event()
  console.log(`[opencode] Got event stream, type: ${typeof eventStream}, has stream: ${'stream' in eventStream}`)

  // The SDK returns a ServerSentEventsResult with a .stream property
  // The stream is an AsyncGenerator that yields events
  return eventStream.stream as AsyncIterable<Event>
}

/**
 * Stop/abort the current OpenCode session activity
 *
 * @param sessionId - OpenCode session ID
 * @param sandboxUrl - Optional URL for the sandbox's OpenCode server (required in production)
 */
export async function stopOpenCode(sessionId: string, sandboxUrl?: string): Promise<void> {
  const client = await getOpenCodeClient(sandboxUrl)
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
  devClientInstance = null
  // Clear sandbox clients cache
  sandboxClients.clear()
}

/**
 * Get available models from OpenCode providers
 * Returns a flat list of all models across all configured providers
 */
export async function getAvailableModels(): Promise<
  Array<{ id: string; name: string; provider: string; description?: string }>
> {
  const client = await getOpenCodeClient()
  const response = await client.config.providers()

  if (response.error) {
    throw new Error(`Failed to get providers: ${JSON.stringify(response.error)}`)
  }

  const data = response.data
  if (!data || typeof data !== 'object' || !('providers' in data)) {
    return []
  }

  const providersData = data as unknown as {
    providers: Array<{
      name: string
      models?: { [key: string]: { name?: string; description?: string } }
    }>
  }

  const models: Array<{ id: string; name: string; provider: string; description?: string }> = []

  for (const provider of providersData.providers) {
    if (provider.models && typeof provider.models === 'object') {
      for (const [modelId, modelInfo] of Object.entries(provider.models)) {
        models.push({
          id: `${provider.name}/${modelId}`,
          name: modelInfo.name || modelId,
          provider: provider.name,
          description: modelInfo.description,
        })
      }
    }
  }

  return models
}

/**
 * Validate if a model ID is available
 */
export async function validateModel(modelId: string): Promise<boolean> {
  const models = await getAvailableModels()
  return models.some((m) => m.id === modelId)
}

/**
 * Switch model for an OpenCode session
 * Updates the session's model configuration
 *
 * Note: OpenCode SDK may not support runtime model switching yet.
 * Model should be set during session creation.
 */
export async function switchModel(_sessionId: string, newModel: string): Promise<void> {
  // Validate model exists
  const isValid = await validateModel(newModel)
  if (!isValid) {
    throw new Error(`Invalid model: ${newModel}`)
  }

  // Note: OpenCode SDK session.update() may not support 'model' parameter yet
  // This is a placeholder for future functionality
  // For now, we store model preference in SessionDO metadata
  // and it will be used when creating new OpenCode sessions
}

/**
 * Filter events for a specific session
 */
export async function* filterSessionEvents(
  eventStream: AsyncIterable<Event>,
  sessionId: string,
): AsyncGenerator<Event> {
  console.log(`[opencode] Starting to filter events for session ${sessionId.slice(0, 8)}...`)
  let count = 0

  for await (const event of eventStream) {
    count++

    // Check if event belongs to this session
    const eventSessionId = getEventSessionId(event)

    if (count <= 5 || count % 10 === 0) {
      console.log(
        `[opencode] Event #${count}: type=${event.type}, session=${eventSessionId?.slice(0, 8) || 'none'}, target=${sessionId.slice(0, 8)}`,
      )
    }

    if (eventSessionId && eventSessionId !== sessionId) {
      continue
    }

    yield event

    // Stop when session becomes idle or errors
    if (event.type === 'session.idle' || event.type === 'session.error') {
      console.log(`[opencode] Stopping event stream: ${event.type}`)
      break
    }
  }

  console.log(`[opencode] Event stream ended after ${count} events`)
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
