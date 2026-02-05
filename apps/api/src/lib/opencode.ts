/**
 * OpenCode SDK wrapper for agent execution (v2 API)
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
 */

// Using v2 SDK - this is critical for proper event streaming
import {
  createOpencodeClient,
  type OpencodeClient,
  type Event,
  type Part,
  type TextPart,
  type ToolPart,
  type Session,
  type TextPartInput,
} from '@opencode-ai/sdk/v2'

// Re-export types for convenience
export type { Event, Part, TextPart, ToolPart, Session, TextPartInput }

// Type for the SSE stream result
interface SSEStreamResult {
  stream: AsyncIterable<Event>
}

// Client instance cache per sandbox URL
const clientCache: Map<string, OpencodeClient> = new Map()

/**
 * Create an OpenCode client for a specific sandbox
 *
 * @param baseUrl - The public URL of the OpenCode server in the sandbox
 * @param directory - Optional directory path for scoping events (e.g., /home/user/repo)
 * @returns OpencodeClient connected to the sandbox
 */
export function createOpenCodeClientForSandbox(baseUrl: string, directory?: string): OpencodeClient {
  // Create a cache key that includes directory for proper scoping
  const cacheKey = `${baseUrl}:${directory || 'global'}`

  // Check cache first
  const cached = clientCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Create new client with v2 API
  const client = createOpencodeClient({
    baseUrl,
    directory, // Important: this scopes events to this directory
  })

  clientCache.set(cacheKey, client)
  return client
}

/**
 * Get OpenCode client (convenience wrapper)
 *
 * @param sandboxUrl - URL for the sandbox's OpenCode server
 * @param directory - Optional directory path for scoping
 */
export function getOpenCodeClient(sandboxUrl: string, directory?: string): OpencodeClient {
  if (!sandboxUrl) {
    throw new Error('OpenCode sandbox URL is required')
  }
  return createOpenCodeClientForSandbox(sandboxUrl, directory)
}

/**
 * Create a new OpenCode session for a project
 *
 * @param projectPath - Path to the project in the sandbox (e.g., /home/user/repo)
 * @param sandboxUrl - URL for the sandbox's OpenCode server
 * @returns Session info with ID
 */
export async function createOpenCodeSession(
  projectPath: string,
  sandboxUrl: string,
): Promise<{ id: string; projectPath: string }> {
  console.log(`[opencode:session] Creating session for path: ${projectPath}, URL: ${sandboxUrl}`)

  const client = getOpenCodeClient(sandboxUrl, projectPath)

  // v2 API: session.create() takes parameters directly, not nested in body
  const response = await client.session.create({
    directory: projectPath,
  })

  console.log(`[opencode:session] Create response:`, JSON.stringify(response).slice(0, 500))

  if (response.error) {
    console.error(`[opencode:session] Failed to create session:`, response.error)
    throw new Error(`Failed to create session: ${JSON.stringify(response.error)}`)
  }

  const session = response.data as Session
  console.log(`[opencode:session] Session created: ${session.id}`)

  return {
    id: session.id,
    projectPath,
  }
}

/**
 * Send a prompt to OpenCode session
 * This initiates the prompt - responses come via event stream
 *
 * @param sessionId - OpenCode session ID
 * @param content - Prompt content
 * @param options - Mode and model settings
 * @param sandboxUrl - URL for the sandbox's OpenCode server
 * @param directory - Project directory path (for proper client scoping)
 */
export async function promptOpenCode(
  sessionId: string,
  content: string,
  options: { mode?: 'build' | 'plan'; model?: string } = {},
  sandboxUrl: string,
  directory?: string,
): Promise<void> {
  console.log(`[opencode:prompt] Sending prompt to session ${sessionId.slice(0, 8)}...`)
  console.log(`[opencode:prompt] URL: ${sandboxUrl}, directory: ${directory}`)
  console.log(`[opencode:prompt] Content length: ${content.length}, mode: ${options.mode}, model: ${options.model}`)

  const client = getOpenCodeClient(sandboxUrl, directory)

  // Build text part
  const textPart: TextPartInput = {
    type: 'text',
    text: content,
  }

  // Parse model string (format: "provider/model" or just "model")
  let model: { providerID: string; modelID: string } | undefined
  if (options.model) {
    const modelParts = options.model.split('/')
    if (modelParts.length === 2) {
      model = {
        providerID: modelParts[0],
        modelID: modelParts[1],
      }
    } else {
      // Assume Anthropic if no provider specified
      model = {
        providerID: 'anthropic',
        modelID: options.model,
      }
    }
    console.log(`[opencode:prompt] Using model: ${model.providerID}/${model.modelID}`)
  } else {
    // Default model
    model = {
      providerID: 'anthropic',
      modelID: 'claude-sonnet-4-20250514',
    }
    console.log(`[opencode:prompt] Using default model: anthropic/claude-sonnet-4-20250514`)
  }

  // Determine agent based on mode
  const agent = options.mode === 'plan' ? 'plan' : 'build'

  console.log(`[opencode:prompt] Calling session.prompt with agent: ${agent}`)

  // v2 API: session.prompt() takes parameters directly
  const response = await client.session.prompt({
    sessionID: sessionId,
    parts: [textPart],
    model,
    agent,
  })

  console.log(`[opencode:prompt] Prompt response status:`, response.error ? 'ERROR' : 'SUCCESS')

  if (response.error) {
    console.error(`[opencode:prompt] Prompt error:`, JSON.stringify(response.error, null, 2))
    throw new Error(`Failed to send prompt: ${JSON.stringify(response.error)}`)
  }

  // Check for errors in response data (OpenCode sometimes returns errors in data.info.error)
  if (response.data && typeof response.data === 'object') {
    const data = response.data as { info?: { error?: unknown } }
    if (data.info?.error) {
      console.error(`[opencode:prompt] Response contains error:`, JSON.stringify(data.info.error, null, 2))
      const errorInfo = data.info.error as { name?: string; data?: { message?: string; statusCode?: number } }

      if (errorInfo.data?.statusCode === 404 && errorInfo.data?.message?.includes('model')) {
        throw new Error(`Model not found: ${model?.providerID}/${model?.modelID}. ${errorInfo.data.message}`)
      }

      throw new Error(`OpenCode error: ${errorInfo.name || 'Unknown'} - ${JSON.stringify(errorInfo.data || errorInfo)}`)
    }
  }

  console.log(`[opencode:prompt] Prompt sent successfully - events will stream via event.subscribe()`)
}

/**
 * Subscribe to OpenCode events
 * Returns an async iterable of events
 *
 * IMPORTANT: The v2 SDK returns { stream: AsyncIterable<Event> }
 * You must iterate over result.stream, not the result directly
 *
 * @param sandboxUrl - URL for the sandbox's OpenCode server
 * @param directory - Optional directory path to scope events to a specific project
 */
export async function subscribeToEvents(sandboxUrl: string, directory?: string): Promise<AsyncIterable<Event>> {
  console.log(
    `[opencode:events] Subscribing to events at ${sandboxUrl}${directory ? `, directory: ${directory}` : ' (global)'}`,
  )

  const client = getOpenCodeClient(sandboxUrl, directory)

  // v2 API: event.subscribe() returns { stream: AsyncIterable<Event> }
  const result = (await client.event.subscribe()) as SSEStreamResult

  console.log(`[opencode:events] Got event subscription result, type: ${typeof result}`)

  if (!result || typeof result !== 'object') {
    throw new Error(`Invalid event subscription result: ${typeof result}`)
  }

  // The SDK returns an object with a stream property
  if ('stream' in result && result.stream) {
    console.log(`[opencode:events] Returning stream from result.stream`)
    return result.stream
  }

  // Fallback: maybe it's directly iterable
  if (Symbol.asyncIterator in result) {
    console.log(`[opencode:events] Result is directly iterable`)
    return result as AsyncIterable<Event>
  }

  throw new Error(`Event subscription did not return an async iterable. Got: ${JSON.stringify(Object.keys(result))}`)
}

/**
 * Stop/abort the current OpenCode session activity
 *
 * @param sessionId - OpenCode session ID
 * @param sandboxUrl - URL for the sandbox's OpenCode server
 * @param directory - Project directory path
 */
export async function stopOpenCode(sessionId: string, sandboxUrl: string, directory?: string): Promise<void> {
  const client = getOpenCodeClient(sandboxUrl, directory)

  // v2 API: session.abort() takes sessionID directly
  await client.session.abort({
    sessionID: sessionId,
  })
}

/**
 * Filter events for a specific session
 * Yields only events that belong to the given session
 *
 * @param eventStream - The event stream to filter
 * @param sessionId - Session ID to filter for
 * @param timeoutMs - Timeout in milliseconds (default 2 minutes)
 */
export async function* filterSessionEvents(
  eventStream: AsyncIterable<Event>,
  sessionId: string,
  timeoutMs: number = 120000,
): AsyncGenerator<Event> {
  console.log(`[opencode:filter] Starting event filter for session ${sessionId.slice(0, 8)}...`)

  let eventCount = 0
  let lastEventTime = Date.now()

  // Timeout warning
  const timeoutWarning = setTimeout(() => {
    console.warn(`[opencode:filter] No events received in ${timeoutMs / 1000}s for session ${sessionId.slice(0, 8)}`)
  }, timeoutMs)

  // Early event detection
  const earlyWarning = setTimeout(() => {
    if (eventCount === 0) {
      console.warn(`[opencode:filter] WARNING: No events received after 5s. Stream may be stuck.`)
    }
  }, 5000)

  try {
    for await (const event of eventStream) {
      clearTimeout(earlyWarning)
      lastEventTime = Date.now()
      eventCount++

      // Get session ID from event
      const eventSessionId = getEventSessionId(event)

      // Log first several events for debugging
      if (eventCount <= 10) {
        console.log(
          `[opencode:filter] Event #${eventCount}: type=${event.type}, eventSession=${eventSessionId?.slice(0, 8) || 'none'}, targetSession=${sessionId.slice(0, 8)}`,
        )
      }

      // Filter: include events that match session OR have no session (global events)
      if (!eventSessionId || eventSessionId === sessionId) {
        yield event

        // Stop on session terminal states
        if (event.type === 'session.idle' || event.type === 'session.error') {
          console.log(`[opencode:filter] Session terminal event: ${event.type}`)
          break
        }
      } else if (eventCount <= 20) {
        // Log filtered events early on for debugging
        console.log(`[opencode:filter] Filtered out event from different session: ${eventSessionId?.slice(0, 8)}`)
      }
    }
  } finally {
    clearTimeout(timeoutWarning)
    clearTimeout(earlyWarning)
    console.log(`[opencode:filter] Event stream ended after ${eventCount} events`)
  }
}

/**
 * Extract session ID from an event
 * Different event types store session ID in different places
 */
function getEventSessionId(event: Event): string | undefined {
  // Most message-related events have part.sessionID
  if (event.type === 'message.part.updated') {
    return event.properties?.part?.sessionID
  }

  if (event.type === 'message.part.removed') {
    return event.properties?.sessionID
  }

  if (event.type === 'message.updated') {
    return event.properties?.info?.sessionID
  }

  if (event.type === 'message.removed') {
    return event.properties?.sessionID
  }

  // Session events
  if (event.type === 'session.status') {
    return event.properties?.sessionID
  }

  if (event.type === 'session.idle') {
    return event.properties?.sessionID
  }

  if (event.type === 'session.error') {
    return event.properties?.sessionID
  }

  if (event.type === 'session.created' || event.type === 'session.updated' || event.type === 'session.deleted') {
    return event.properties?.info?.id
  }

  if (event.type === 'session.compacted') {
    return event.properties?.sessionID
  }

  if (event.type === 'session.diff') {
    return event.properties?.sessionID
  }

  // Permission events
  if (event.type === 'permission.asked' || event.type === 'permission.replied') {
    return event.properties?.sessionID
  }

  // Question events
  if (event.type === 'question.asked' || event.type === 'question.replied' || event.type === 'question.rejected') {
    return event.properties?.sessionID
  }

  // Todo events
  if (event.type === 'todo.updated') {
    return event.properties?.sessionID
  }

  // Command events
  if (event.type === 'command.executed') {
    return event.properties?.sessionID
  }

  // Global events have no session ID
  return undefined
}

/**
 * Cleanup cached clients
 */
export function cleanupOpenCode(): void {
  clientCache.clear()
}

/**
 * Get available models from OpenCode providers
 */
export async function getAvailableModels(
  sandboxUrl: string,
  directory?: string,
): Promise<Array<{ id: string; name: string; provider: string; description?: string }>> {
  const client = getOpenCodeClient(sandboxUrl, directory)
  const response = await client.config.providers()

  if (response.error) {
    throw new Error(`Failed to get providers: ${JSON.stringify(response.error)}`)
  }

  const data = response.data
  if (!data || typeof data !== 'object') {
    return []
  }

  const providersData = data as {
    providers?: Array<{
      id: string
      name: string
      models?: Record<string, { name?: string; description?: string }>
    }>
  }

  const models: Array<{ id: string; name: string; provider: string; description?: string }> = []

  for (const provider of providersData.providers || []) {
    if (provider.models && typeof provider.models === 'object') {
      for (const [modelId, modelInfo] of Object.entries(provider.models)) {
        models.push({
          id: `${provider.id}/${modelId}`,
          name: modelInfo.name || modelId,
          provider: provider.name || provider.id,
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
export async function validateModel(modelId: string, sandboxUrl: string, directory?: string): Promise<boolean> {
  const models = await getAvailableModels(sandboxUrl, directory)
  return models.some((m) => m.id === modelId)
}

/**
 * Get session info
 */
export async function getSessionInfo(
  sessionId: string,
  sandboxUrl: string,
  directory?: string,
): Promise<Session | null> {
  const client = getOpenCodeClient(sandboxUrl, directory)

  const response = await client.session.get({
    sessionID: sessionId,
  })

  if (response.error) {
    console.warn(`[opencode:session] Failed to get session ${sessionId}:`, response.error)
    return null
  }

  return response.data as Session
}

/**
 * List all sessions
 */
export async function listSessions(sandboxUrl: string, directory?: string): Promise<Session[]> {
  const client = getOpenCodeClient(sandboxUrl, directory)

  const response = await client.session.list()

  if (response.error) {
    console.warn(`[opencode:session] Failed to list sessions:`, response.error)
    return []
  }

  return (response.data || []) as Session[]
}
