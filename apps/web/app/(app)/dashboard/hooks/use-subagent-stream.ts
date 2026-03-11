'use client'

import { useState, useEffect, useRef } from 'react'
import { API_URL } from '@/lib/config'
import {
  type UIMessage,
  createAssistantPlaceholder,
  processPartUpdated,
} from '@/lib/ai-elements-adapter'
import { parseSSEEvent } from '@/lib/sse-parser'
import type { MessagePartUpdatedEvent } from '@/lib/sse-types'

function getStatusFromPart(part: { type?: string; tool?: string; state?: { status?: string; input?: Record<string, unknown> } }): string | null {
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
    if (tool.includes('bash') || tool.includes('run') || tool.includes('command')) return short ? `Running: ${short}` : 'Running command...'
    if (tool.includes('glob') || tool.includes('grep') || tool.includes('search')) return short ? `Searching: ${short}` : `Searching: ${part.tool}`
    return short ? `${part.tool}: ${short}` : `Running: ${part.tool}`
  }
  return null
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

    const controller = new AbortController()
    abortRef.current = controller

    const url = `${API_URL}/chat/${encodeURIComponent(parentSessionId)}/subagent/${encodeURIComponent(subagentSessionId)}/stream`

    fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/event-stream' },
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Stream failed: ${res.status}`)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

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
            if (line.startsWith('data: ')) {
              try {
                const raw = JSON.parse(line.slice(6))
                const event = parseSSEEvent(raw)
                if (!event) continue

                if (event.type === 'message.part.updated') {
                  const mpu = event as MessagePartUpdatedEvent
                  const part = mpu.properties?.part
                  const msgId = messageIdRef.current
                  if (msgId) {
                    setMessages((prev) =>
                      processPartUpdated(
                        part,
                        mpu.properties?.delta,
                        msgId,
                        prev,
                        textRef,
                        reasoningRef,
                      ),
                    )
                  }
                  const partStatus = getStatusFromPart(part) || 'Thinking...'
                  setStatus(partStatus)
                  setStatusSteps((prev) => {
                    if (prev.length > 0 && prev[prev.length - 1] === partStatus) return prev
                    return [...prev, partStatus]
                  })
                }

                if (event.type === 'status' && (event as { message?: string }).message) {
                  const msg = (event as { message: string }).message
                  setStatus(msg)
                  setStatusSteps((prev) => {
                    if (prev.length > 0 && prev[prev.length - 1] === msg) return prev
                    return [...prev, msg]
                  })
                }

                if (event.type === 'done' || event.type === 'session.idle') {
                  const msgId = messageIdRef.current
                  const elapsed = streamStartRef.current
                    ? Date.now() - streamStartRef.current
                    : 0
                  if (msgId && elapsed > 0) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === msgId
                          ? {
                              ...m,
                              content: textRef.current,
                              reasoning: reasoningRef.current
                                ? [reasoningRef.current]
                                : undefined,
                              elapsed,
                            }
                          : m,
                      ),
                    )
                  }
                  setIsStreaming(false)
                  setStatus('Complete')
                }

                if (event.type === 'session.error' || event.type === 'error') {
                  setIsStreaming(false)
                  setStatus('Error')
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
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
