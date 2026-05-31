import { create } from 'zustand'
import type { MutableRefObject } from 'react'
import type { OrderedMessagePart } from '@/lib/ai-elements-adapter'

/** Ephemeral streaming text accumulated before flush into React state. */
export interface StreamingBuffer {
  messageId: string | null
  text: string
  reasoning: string
  orderedParts: OrderedMessagePart[]
}

const EMPTY_BUFFER: StreamingBuffer = {
  messageId: null,
  text: '',
  reasoning: '',
  orderedParts: [],
}

/** Module-level refs avoid Zustand updates on every streaming token. */
const bufferRefs = new Map<string, StreamingBuffer>()

function getOrCreateBufferRef(sessionId: string): StreamingBuffer {
  let buffer = bufferRefs.get(sessionId)
  if (!buffer) {
    buffer = { ...EMPTY_BUFFER, orderedParts: [] }
    bufferRefs.set(sessionId, buffer)
  }
  return buffer
}

export interface SessionStreamingRefs {
  streamingMessageRef: MutableRefObject<string | null>
  assistantTextRef: MutableRefObject<string>
  reasoningRef: MutableRefObject<string>
  orderedPartsRef: MutableRefObject<OrderedMessagePart[]>
}

/** Returns ref-compatible accessors backed by the module-level buffer for {@link sessionId}. */
export function getStreamingRefs(sessionId: string): SessionStreamingRefs {
  const buffer = getOrCreateBufferRef(sessionId)
  return {
    streamingMessageRef: {
      get current() {
        return buffer.messageId
      },
      set current(value: string | null) {
        buffer.messageId = value
      },
    },
    assistantTextRef: {
      get current() {
        return buffer.text
      },
      set current(value: string) {
        buffer.text = value
      },
    },
    reasoningRef: {
      get current() {
        return buffer.reasoning
      },
      set current(value: string) {
        buffer.reasoning = value
      },
    },
    orderedPartsRef: {
      get current() {
        return buffer.orderedParts
      },
      set current(value: OrderedMessagePart[]) {
        buffer.orderedParts = value
      },
    },
  }
}

/**
 * Ref-compatible accessors for whichever session is currently active in the dashboard.
 *
 * @param getActiveSessionId - Returns the active session id (may change between reads)
 */
export function createActiveSessionStreamingRefs(getActiveSessionId: () => string | null): SessionStreamingRefs {
  return {
    streamingMessageRef: {
      get current() {
        const sessionId = getActiveSessionId()
        return sessionId ? getOrCreateBufferRef(sessionId).messageId : null
      },
      set current(value: string | null) {
        const sessionId = getActiveSessionId()
        if (!sessionId) return
        getOrCreateBufferRef(sessionId).messageId = value
      },
    },
    assistantTextRef: {
      get current() {
        const sessionId = getActiveSessionId()
        return sessionId ? getOrCreateBufferRef(sessionId).text : ''
      },
      set current(value: string) {
        const sessionId = getActiveSessionId()
        if (!sessionId) return
        getOrCreateBufferRef(sessionId).text = value
      },
    },
    reasoningRef: {
      get current() {
        const sessionId = getActiveSessionId()
        return sessionId ? getOrCreateBufferRef(sessionId).reasoning : ''
      },
      set current(value: string) {
        const sessionId = getActiveSessionId()
        if (!sessionId) return
        getOrCreateBufferRef(sessionId).reasoning = value
      },
    },
    orderedPartsRef: {
      get current() {
        const sessionId = getActiveSessionId()
        return sessionId ? getOrCreateBufferRef(sessionId).orderedParts : []
      },
      set current(value: OrderedMessagePart[]) {
        const sessionId = getActiveSessionId()
        if (!sessionId) return
        getOrCreateBufferRef(sessionId).orderedParts = value
      },
    },
  }
}

/** Clear in-flight streaming buffer fields for a session without removing store keys. */
export function clearStreamingBuffer(sessionId: string): void {
  const buffer = bufferRefs.get(sessionId)
  if (!buffer) return
  buffer.messageId = null
  buffer.text = ''
  buffer.reasoning = ''
  buffer.orderedParts = []
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
      orderedParts: [...buffer.orderedParts],
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
