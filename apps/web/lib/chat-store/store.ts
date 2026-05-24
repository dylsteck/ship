import { create } from 'zustand'

/** Ephemeral streaming text accumulated before flush into React state. */
export interface StreamingBuffer {
  messageId: string | null
  text: string
  reasoning: string
}

const EMPTY_BUFFER: StreamingBuffer = {
  messageId: null,
  text: '',
  reasoning: '',
}

/** Module-level refs avoid Zustand updates on every streaming token. */
const bufferRefs = new Map<string, StreamingBuffer>()

function getOrCreateBufferRef(sessionId: string): StreamingBuffer {
  let buffer = bufferRefs.get(sessionId)
  if (!buffer) {
    buffer = { ...EMPTY_BUFFER }
    bufferRefs.set(sessionId, buffer)
  }
  return buffer
}

export interface ChatStoreState {
  streamingBuffers: Record<string, StreamingBuffer>
  isStreamingBySessionId: Record<string, boolean>
  setStreamingBuffer: (sessionId: string, update: Partial<StreamingBuffer>) => void
  flushStreamingBuffer: (sessionId: string) => StreamingBuffer | null
  setIsStreaming: (sessionId: string, isStreaming: boolean) => void
  resetSession: (sessionId: string) => void
}

/** Zustand store for per-session streaming buffers and streaming flags. */
export const useChatStore = create<ChatStoreState>((set) => ({
  streamingBuffers: {},
  isStreamingBySessionId: {},

  setStreamingBuffer(sessionId, update) {
    const buffer = getOrCreateBufferRef(sessionId)
    Object.assign(buffer, update)
  },

  flushStreamingBuffer(sessionId) {
    const buffer = bufferRefs.get(sessionId)
    if (!buffer) {
      return null
    }

    const snapshot: StreamingBuffer = {
      messageId: buffer.messageId,
      text: buffer.text,
      reasoning: buffer.reasoning,
    }

    set((state) => ({
      streamingBuffers: {
        ...state.streamingBuffers,
        [sessionId]: snapshot,
      },
    }))

    return snapshot
  },

  setIsStreaming(sessionId, isStreaming) {
    set((state) => ({
      isStreamingBySessionId: {
        ...state.isStreamingBySessionId,
        [sessionId]: isStreaming,
      },
    }))
  },

  resetSession(sessionId) {
    bufferRefs.delete(sessionId)
    set((state) => {
      const { [sessionId]: _buffer, ...streamingBuffers } = state.streamingBuffers
      const { [sessionId]: _streaming, ...isStreamingBySessionId } = state.isStreamingBySessionId
      return { streamingBuffers, isStreamingBySessionId }
    })
  },
}))
