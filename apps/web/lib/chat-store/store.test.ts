import { describe, expect, it } from 'vitest'

import { clearStreamingBuffer, createActiveSessionStreamingRefs, getStreamingRefs, useChatStore } from './store'

describe('chat-store streaming buffers', () => {
  it('stores hot-path text per session via getStreamingRefs', () => {
    const refs = getStreamingRefs('session-a')
    refs.assistantTextRef.current = 'hello'
    refs.reasoningRef.current = 'thinking'
    refs.streamingMessageRef.current = 'msg-1'

    const other = getStreamingRefs('session-b')
    other.assistantTextRef.current = 'other'

    expect(getStreamingRefs('session-a').assistantTextRef.current).toBe('hello')
    expect(getStreamingRefs('session-a').reasoningRef.current).toBe('thinking')
    expect(getStreamingRefs('session-a').streamingMessageRef.current).toBe('msg-1')
    expect(getStreamingRefs('session-b').assistantTextRef.current).toBe('other')
  })

  it('flushes buffer snapshots into Zustand state', () => {
    const refs = getStreamingRefs('session-flush')
    refs.assistantTextRef.current = 'streamed'
    refs.streamingMessageRef.current = 'msg-flush'

    const snapshot = useChatStore.getState().flushStreamingBuffer('session-flush')
    expect(snapshot).toEqual({
      messageId: 'msg-flush',
      text: 'streamed',
      reasoning: '',
      orderedParts: [],
    })
    expect(useChatStore.getState().streamingBuffers['session-flush']).toEqual(snapshot)
  })

  it('routes active-session proxies to the current session id', () => {
    let activeId: string | null = 'live-session'
    const activeRefs = createActiveSessionStreamingRefs(() => activeId)
    activeRefs.assistantTextRef.current = 'live text'

    expect(getStreamingRefs('live-session').assistantTextRef.current).toBe('live text')

    activeId = 'next-session'
    activeRefs.assistantTextRef.current = 'next text'
    expect(getStreamingRefs('next-session').assistantTextRef.current).toBe('next text')
    expect(getStreamingRefs('live-session').assistantTextRef.current).toBe('live text')
  })

  it('clears buffer fields without removing session streaming flags', () => {
    useChatStore.getState().setIsStreaming('session-clear', true)
    const refs = getStreamingRefs('session-clear')
    refs.assistantTextRef.current = 'partial'
    refs.streamingMessageRef.current = 'msg-clear'

    clearStreamingBuffer('session-clear')

    expect(refs.assistantTextRef.current).toBe('')
    expect(refs.streamingMessageRef.current).toBeNull()
    expect(useChatStore.getState().isStreamingBySessionId['session-clear']).toBe(true)
  })

  it('resetSession removes buffer and streaming flag', () => {
    const refs = getStreamingRefs('session-reset')
    refs.assistantTextRef.current = 'x'
    useChatStore.getState().setIsStreaming('session-reset', true)
    useChatStore.getState().resetSession('session-reset')

    refs.assistantTextRef.current = 'after-reset'
    expect(refs.assistantTextRef.current).toBe('after-reset')
    expect(useChatStore.getState().isStreamingBySessionId['session-reset']).toBeUndefined()
  })
})
