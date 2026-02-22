'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL } from '@/lib/config'
import {
  type UIMessage,
  createAssistantPlaceholder,
  processPartUpdated,
} from '@/lib/ai-elements-adapter'
import { parseSSEEvent } from '@/lib/sse-parser'
import type { MessagePartUpdatedEvent } from '@/lib/sse-types'

interface UseSubagentStreamParams {
  parentSessionId: string | null
  subagentSessionId: string | null
}

interface UseSubagentStreamResult {
  messages: UIMessage[]
  isStreaming: boolean
  status: string
}

export function useSubagentStream({
  parentSessionId,
  subagentSessionId,
}: UseSubagentStreamParams): UseSubagentStreamResult {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const messageIdRef = useRef<string | null>(null)
  const textRef = useRef('')
  const reasoningRef = useRef('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!parentSessionId || !subagentSessionId) {
      setMessages([])
      setIsStreaming(false)
      setStatus('')
      return
    }

    const placeholder = createAssistantPlaceholder()
    messageIdRef.current = placeholder.id
    setMessages([placeholder])
    setIsStreaming(true)
    setStatus('Connecting...')
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
                  const msgId = messageIdRef.current
                  if (msgId) {
                    setMessages((prev) =>
                      processPartUpdated(
                        mpu.properties.part,
                        mpu.properties.delta,
                        msgId,
                        prev,
                        textRef,
                        reasoningRef,
                      ),
                    )
                  }
                  setStatus('Working...')
                }

                if (event.type === 'done' || event.type === 'session.idle') {
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

  return { messages, isStreaming, status }
}
