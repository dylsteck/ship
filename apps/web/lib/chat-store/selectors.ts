import type { ChatStoreState, StreamingBuffer } from './store'

const EMPTY_BUFFER: StreamingBuffer = {
  messageId: null,
  text: '',
  reasoning: '',
}

/**
 * Select the flushed streaming buffer snapshot for a session.
 *
 * @param sessionId - Chat session id
 */
export function selectStreamingState(sessionId: string): (state: ChatStoreState) => StreamingBuffer {
  return (state) => state.streamingBuffers[sessionId] ?? EMPTY_BUFFER
}

/**
 * Select whether a session currently has an active SSE stream.
 *
 * @param sessionId - Chat session id
 */
export function selectIsStreaming(sessionId: string): (state: ChatStoreState) => boolean {
  return (state) => state.isStreamingBySessionId[sessionId] ?? false
}
