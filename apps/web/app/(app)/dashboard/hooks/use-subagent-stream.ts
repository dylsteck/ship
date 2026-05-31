'use client'

import { useState, useEffect, useRef } from 'react'
import { streamSubagentSession } from '@/lib/api'
import {
  type OrderedMessagePart,
  type UIMessage,
  createAssistantPlaceholder,
  processPartUpdated,
} from '@/lib/ai-elements-adapter'
import { parseSSEEvent } from '@/lib/sse-parser'
import type { MessagePartUpdatedEvent } from '@/lib/sse-types'

export function getStatusFromPart(part: {
  type?: string
  tool?: string
  state?: { status?: string; input?: Record<string, unknown> }
}): string | null {
  if (!part) return null
  if (part.type === 'reasoning') return 'Thinking...'
  if (part.type === 'text') return 'Writing response...'
  if (part.type === 'tool' && part.tool) {
    const tool = part.tool.toLowerCase()
    const state = part.state?.status || 'running'
    const title = (part.state?.input as Record<string, unknown>)?.description || part.state?.input?.title
    const short = typeof title === 'string' ? title.slice(0, 40) + (title.length > 40 ? '...' : '') : null
    if (state === 'pending') return `Starting: ${part.tool}`
    if (tool.includes('read')) return short ? `Reading: ${short}` : 'Reading files...'
    if (tool.includes('write') || tool.includes('edit')) return short ? `Writing: ${short}` : 'Writing...'
    if (tool.includes('bash') || tool.includes('run') || tool.includes('command'))
      return short ? `Running: ${short}` : 'Running command...'
    if (tool.includes('glob') || tool.includes('grep') || tool.includes('search'))
      return short ? `Searching: ${short}` : `Searching: ${part.tool}`
    return short ? `${part.tool}: ${short}` : `Running: ${part.tool}`
  }
  return null
}

interface StreamRefs {
  messageIdRef: React.MutableRefObject<string | null>
  textRef: React.MutableRefObject<string>
  reasoningRef: React.MutableRefObject<string>
  orderedPartsRef: React.MutableRefObject<OrderedMessagePart[]>
  streamStartRef: React.MutableRefObject<number | null>
}

interface StreamSetters {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  setStatusSteps: React.Dispatch<React.SetStateAction<string[]>>
}

function appendStatusStep(setStatusSteps: React.Dispatch<React.SetStateAction<string[]>>, msg: string) {
  setStatusSteps((prev) => {
    if (prev.length > 0 && prev[prev.length - 1] === msg) return prev
    return [...prev, msg]
  })
}

function handleSubagentStreamEvent(
  event: ReturnType<typeof parseSSEEvent>,
  refs: StreamRefs,
  setters: StreamSetters,
): void {
  if (!event) return

  if (event.type === 'message.part.updated') {
    const mpu = event as MessagePartUpdatedEvent
    const part = mpu.properties?.part
    const msgId = refs.messageIdRef.current
    if (msgId) {
      setters.setMessages((prev) =>
        processPartUpdated(
          part,
          mpu.properties?.delta,
          msgId,
          prev,
          refs.textRef,
          refs.reasoningRef,
          refs.orderedPartsRef,
        ),
      )
    }
    const partStatus = getStatusFromPart(part) || 'Thinking...'
    setters.setStatus(partStatus)
    appendStatusStep(setters.setStatusSteps, partStatus)
  }

  if (event.type === 'status' && (event as { message?: string }).message) {
    const msg = (event as { message: string }).message
    setters.setStatus(msg)
    appendStatusStep(setters.setStatusSteps, msg)
  }

  if (event.type === 'done' || event.type === 'session.idle') {
    const msgId = refs.messageIdRef.current
    const elapsed = refs.streamStartRef.current ? Date.now() - refs.streamStartRef.current : 0
    if (msgId && elapsed > 0) {
      setters.setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                content: refs.textRef.current,
                reasoning: refs.reasoningRef.current ? [refs.reasoningRef.current] : undefined,
                orderedParts: refs.orderedPartsRef.current,
                elapsed,
              }
            : m,
        ),
      )
    }
    setters.setIsStreaming(false)
    setters.setStatus('Complete')
  }

  if (event.type === 'session.error' || event.type === 'error') {
    setters.setIsStreaming(false)
    setters.setStatus('Error')
  }
}

async function readSubagentSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  refs: StreamRefs,
  setters: StreamSetters,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let currentEvent = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
        continue
      }
      if (!line.startsWith('data: ')) continue
      try {
        const raw = JSON.parse(line.slice(6))
        handleSubagentStreamEvent(parseSSEEvent(raw), refs, setters)
      } catch {
        // Ignore parse errors
      }
    }
  }
}

interface UseSubagentStreamParams {
  parentSessionId: string | null
  subagentSessionId: string | null
}

interface UseSubagentStreamResult {
  messages: UIMessage[]
  isStreaming: boolean
  status: string
  statusSteps: string[]
}

export function useSubagentStream({
  parentSessionId,
  subagentSessionId,
}: UseSubagentStreamParams): UseSubagentStreamResult {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [statusSteps, setStatusSteps] = useState<string[]>([])
  const messageIdRef = useRef<string | null>(null)
  const textRef = useRef('')
  const reasoningRef = useRef('')
  const orderedPartsRef = useRef<OrderedMessagePart[]>([])
  const streamStartRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!parentSessionId || !subagentSessionId) {
      setMessages([])
      setIsStreaming(false)
      setStatus('')
      setStatusSteps([])
      return
    }

    const placeholder = createAssistantPlaceholder()
    messageIdRef.current = placeholder.id
    streamStartRef.current = Date.now()
    setMessages([placeholder])
    setIsStreaming(true)
    setStatus('Connecting...')
    setStatusSteps(['Connecting...'])
    textRef.current = ''
    reasoningRef.current = ''
    orderedPartsRef.current = []

    const controller = new AbortController()
    abortRef.current = controller

    const refs = { messageIdRef, textRef, reasoningRef, orderedPartsRef, streamStartRef }
    const setters = { setMessages, setIsStreaming, setStatus, setStatusSteps }

    streamSubagentSession(parentSessionId, subagentSessionId, controller.signal)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Stream failed: ${res.status}`)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')
        await readSubagentSSEStream(reader, refs, setters)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error('[useSubagentStream] Stream error:', err)
        setIsStreaming(false)
        setStatus('Error')
      })
      .finally(() => {
        abortRef.current = null
      })

    return () => {
      controller.abort()
    }
  }, [parentSessionId, subagentSessionId])

  return { messages, isStreaming, status, statusSteps }
}
