'use client'

import React from 'react'

export function DashboardClient() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold">Dashboard placeholder</h2>
      <p className="mt-4 text-muted-foreground">UI has been refactored to AI Elements components.</p>
    </div>
  )
}

export function DashboardClient({ sessions: initialSessions, userId, user }: DashboardClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setMode] = useState<'build' | 'plan'>('build')
  const [prompt, setPrompt] = useState('')

  // Local sessions state (so we can add new sessions immediately)
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(initialSessions)

  // Chat state for in-place transformation
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  const [thinkingReasoning, setThinkingReasoning] = useState<string>('')
  const [thinkingStatus, setThinkingStatus] = useState<string>('Thinking')
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [messageQueue, setMessageQueue] = useState<string[]>([])

  // New typed SSE state for rich activity display
  const [activityTools, setActivityTools] = useState<SSEToolPart[]>([])
  const [reasoningParts, setReasoningParts] = useState<ReasoningPart[]>([])
  const [statusEvents, setStatusEvents] = useState<Array<{ status: string; message: string; time: number }>>([])
  const [openCodeUrl, setOpenCodeUrl] = useState<string>('')
  const [lastStepCost, setLastStepCost] = useState<{ cost: number; tokens: StepFinishPart['tokens'] } | null>(null)
  const [sessionTodos, setSessionTodos] = useState<
    Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
      priority: 'high' | 'medium' | 'low'
    }>
  >([])
  const [fileDiffs, setFileDiffs] = useState<Array<{ filename: string; additions: number; deletions: number }>>([])
  const [contextTokens, setContextTokens] = useState<number>(0)
  const [totalCost, setTotalCost] = useState<number>(0)
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)

  // Refs
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch repos and models with SWR
  const { repos, isLoading: reposLoading } = useGitHubRepos(userId)
  const { models, groupedByProvider, isLoading: modelsLoading } = useModels()
  const { createSession, isCreating } = useCreateSession()

  // Set default model once loaded - prefer Big Pickle (free stealth model via OpenCode Zen)
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      // Find Big Pickle as the preferred default (new ID format)
      const preferredDefault = models.find((m) => m.id === 'kimi-k2.5-free')
      // Or find any model marked as default
      const markedDefault = models.find((m) => m.isDefault)
      // Fall back to first model
      setSelectedModel(preferredDefault || markedDefault || models[0])
    }
  }, [models, selectedModel])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (activeSessionId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeSessionId, isStreaming])

  // Connect WebSocket for real-time updates
  const connectWebSocket = useCallback((sessionId: string) => {
    wsRef.current?.disconnect()

    const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket`

    wsRef.current = createReconnectingWebSocket({
      url: wsUrl,
      onMessage: (data: unknown) => {
        const event = data as {
          type: string
          message?: Message | string
          messageId?: string
          parts?: string
          category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
          retryable?: boolean
          prUrl?: string
        }

        if (event.type === 'message') {
          const msg = event.message as Message
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === msg?.id)
            if (exists) return prev
            return [...prev, msg]
          })
        }

        if (event.type === 'message-parts') {
          setMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, parts: event.parts } : m)))
        }

        if (event.type === 'error') {
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: typeof event.message === 'string' ? event.message : 'An error occurred',
            type: 'error',
            errorCategory: event.category || 'persistent',
            retryable: event.retryable || false,
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => [...prev, errorMessage])
        }

        if (event.type === 'pr-created') {
          const prMessage: Message = {
            id: `pr-${Date.now()}`,
            role: 'system',
            content: `Draft PR created: ${event.prUrl}`,
            type: 'pr-notification',
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => [...prev, prMessage])
        }

        // Handle sandbox status updates
        if (event.type === 'sandbox-status') {
          const status = (event as { status?: string }).status
          if (status === 'ready') {
            setThinkingStatus('Sandbox ready')
            setStatusEvents((prev) => [
              ...prev,
              { status: 'sandbox-ready', message: 'Sandbox ready', time: Date.now() },
            ])
          } else if (status === 'error') {
            setThinkingStatus('Sandbox error')
            setStatusEvents((prev) => [...prev, { status: 'error', message: 'Sandbox error', time: Date.now() }])
          } else if (status === 'provisioning') {
            setStatusEvents((prev) => [
              ...prev,
              { status: 'provisioning', message: 'Provisioning sandbox...', time: Date.now() },
            ])
          }
        }

        // Handle OpenCode server started
        if (event.type === 'opencode-started') {
          setThinkingStatus('OpenCode started')
          setStatusEvents((prev) => [
            ...prev,
            { status: 'starting-opencode', message: 'Starting OpenCode server...', time: Date.now() },
          ])
        }

        // Handle OpenCode URL
        if (event.type === 'opencode-url') {
          const url = (event as { url?: string }).url
          if (url) {
            setOpenCodeUrl(url)
            console.log('[dashboard-client] OpenCode URL received:', url)
          }
        }

        // Handle OpenCode events for real-time activity
        if (event.type === 'opencode-event') {
          const ocEvent = (
            event as {
              event?: {
                type?: string
                payload?: { type?: string }
                properties?: {
                  part?: {
                    type?: string
                    tool?: string | { name?: string }
                    callID?: string
                    state?: { title?: string; status?: string }
                  }
                  delta?: string
                }
              }
            }
          ).event

          // Handle server connection
          if (ocEvent?.payload?.type === 'server.connected') {
            setThinkingStatus('Connected to agent')
            setStatusEvents((prev) => [
              ...prev,
              { status: 'agent-active', message: 'Connected to agent', time: Date.now() },
            ])
            return
          }

          // Handle message.part.updated events (tool calls, text, etc.)
          if (ocEvent?.type === 'message.part.updated') {
            const part = ocEvent.properties?.part
            if (part?.type === 'tool') {
              // Extract tool name
              const toolName = typeof part.tool === 'string' ? part.tool : part.tool?.name
              const toolTitle = part.state?.title || ''
              const toolStatus = part.state?.status

              // Add to thinking parts for the ThinkingIndicator
              if (toolName && part.callID) {
                const toolPart: ToolPart = {
                  type: 'tool',
                  callID: part.callID,
                  tool: toolName,
                  state: {
                    title: toolTitle,
                    status: toolStatus as 'pending' | 'running' | 'complete' | 'error' | undefined,
                  },
                }
                setThinkingParts((prev) => {
                  const existing = prev.findIndex((p) => p.callID === toolPart.callID)
                  if (existing >= 0) {
                    return prev.map((p, i) => (i === existing ? toolPart : p))
                  }
                  return [...prev, toolPart]
                })
              }

              // Update status based on tool type
              if (toolName) {
                const name = toolName.toLowerCase()
                if (name.includes('read') || name.includes('glob') || name.includes('grep')) {
                  setThinkingStatus(`Reading: ${toolTitle.slice(0, 40) || 'files...'}`)
                } else if (name.includes('write') || name.includes('edit')) {
                  setThinkingStatus(`Writing: ${toolTitle.slice(0, 40) || 'code...'}`)
                } else if (name.includes('bash') || name.includes('run') || name.includes('shell')) {
                  setThinkingStatus(`Running: ${toolTitle.slice(0, 40) || 'command...'}`)
                } else if (name.includes('task') || name.includes('agent')) {
                  setThinkingStatus('Creating task...')
                } else if (name.includes('search') || name.includes('semantic')) {
                  setThinkingStatus(`Searching: ${toolTitle.slice(0, 40) || '...'}`)
                } else {
                  setThinkingStatus(`${toolName}: ${toolTitle.slice(0, 30)}`)
                }
              }
            } else if (part?.type === 'text') {
              // Text being generated - keep the thinking status
              setThinkingStatus('Thinking...')
            } else if (part?.type === 'reasoning') {
              setThinkingStatus('Reasoning...')
            }
          }

          // Handle other event types
          if (ocEvent?.type === 'session.status') {
            const status = (ocEvent as { properties?: { status?: string } }).properties?.status
            if (status) {
              setThinkingStatus(status)
            }
          }

          if (ocEvent?.type === 'todo.updated') {
            setThinkingStatus('Updating tasks...')
          }

          if (ocEvent?.type === 'file-watcher.updated') {
            const props = (ocEvent as { properties?: { event?: string; path?: string } }).properties
            if (props?.event && props?.path) {
              setThinkingStatus(`${props.event}: ${props.path.split('/').pop()}`)
            }
          }
        }
      },
      onStatusChange: setWsStatus,
    })
  }, [])

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => wsRef.current?.disconnect()
  }, [])

  // Process queued messages when streaming completes
  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0 && activeSessionId) {
      const [next, ...rest] = messageQueue
      setMessageQueue(rest)
      handleSend(next)
    }
  }, [isStreaming, messageQueue, activeSessionId])

  // Handle sending a message (SSE streaming)
  // sessionIdOverride allows passing the session ID directly when state hasn't updated yet
  const handleSend = useCallback(
    async (content: string, modeOverride?: 'build' | 'plan', sessionIdOverride?: string) => {
      const targetSessionId = sessionIdOverride || activeSessionId
      if (!targetSessionId) return

      if (isStreaming) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      setThinkingParts([])
      setThinkingReasoning('')
      setThinkingStatus('Starting')
      assistantTextRef.current = ''

      // Reset new typed SSE state
      setActivityTools([])
      setReasoningParts([])
      setLastStepCost(null)
      setStreamStartTime(Date.now())

      // Optimistically add user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        createdAt: Math.floor(Date.now() / 1000),
      }
      setMessages((prev) => [...prev, userMessage])

      // Create placeholder for assistant message
      const assistantId = `temp-assistant-${Date.now()}`
      streamingMessageRef.current = assistantId
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Math.floor(Date.now() / 1000),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        const response = await sendChatMessage(targetSessionId, content, modeOverride ?? mode)

        // Check for non-OK responses (500, etc.) before trying to read stream
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Chat request failed:', errorData)

          // Add error message to chat
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: errorData.error || errorData.details || 'Failed to start agent',
            type: 'error',
            errorCategory: 'persistent',
            retryable: false,
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => {
            // Remove the empty assistant placeholder and add error
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, errorMessage]
          })

          // Clear streaming state and status
          setIsStreaming(false)
          setThinkingStatus('') // Clear "Starting" status
          streamingMessageRef.current = null
          return
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let currentEventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim()
              continue
            }
            if (line.startsWith('data: ')) {
              try {
                const rawData = JSON.parse(line.slice(6))
                // Use event type from 'event:' line if data.type is not present
                if (!rawData.type && currentEventType) {
                  rawData.type = currentEventType
                }
                const event = parseSSEEvent(rawData)
                if (!event) continue

                // Handle based on event type using typed parser
                switch (event.type) {
                  case 'message.part.updated': {
                    const part = event.properties.part
                    const delta = event.properties.delta

                    // Handle text parts
                    if (part.type === 'text') {
                      if (typeof delta === 'string') {
                        assistantTextRef.current += delta
                      } else if (part.text) {
                        assistantTextRef.current = part.text
                      }
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === streamingMessageRef.current ? { ...m, content: assistantTextRef.current } : m,
                        ),
                      )
                    }

                    // Handle tool parts - update both old and new state for backward compatibility
                    if (part.type === 'tool') {
                      const toolPart: SSEToolPart = {
                        id: part.id,
                        sessionID: part.sessionID,
                        messageID: part.messageID,
                        type: 'tool',
                        callID: part.callID,
                        tool: part.tool,
                        state: part.state,
                      }

                      // Update new typed activity tools
                      setActivityTools((prev) => {
                        const existing = prev.findIndex((t) => t.callID === toolPart.callID)
                        if (existing >= 0) {
                          return prev.map((t, i) => (i === existing ? toolPart : t))
                        }
                        return [...prev, toolPart]
                      })

                      // Also update old thinkingParts for backward compatibility
                      const oldToolPart: ToolPart = {
                        type: 'tool',
                        callID: part.callID,
                        tool: part.tool,
                        state: {
                          title: part.state.title || '',
                          status: part.state.status === 'completed' ? 'complete' : part.state.status,
                        },
                      }
                      setThinkingParts((prev) => {
                        const existing = prev.findIndex((p) => p.callID === oldToolPart.callID)
                        if (existing >= 0) {
                          return prev.map((p, i) => (i === existing ? oldToolPart : p))
                        }
                        return [...prev, oldToolPart]
                      })

                      // Update status label using typed helper
                      const statusInfo = getEventStatus(event)
                      if (statusInfo) {
                        setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                      }
                    }

                    // Handle reasoning parts
                    if (part.type === 'reasoning' && part.text) {
                      setThinkingReasoning((prev) => (prev ? `${prev}\n\n${part.text}` : part.text))
                      setThinkingStatus('💭 Reasoning...')

                      // Add to reasoningParts array for ActivityFeed
                      const reasoningPart: ReasoningPart = {
                        id: part.id,
                        sessionID: part.sessionID,
                        messageID: part.messageID,
                        type: 'reasoning',
                        text: part.text,
                      }
                      setReasoningParts((prev) => [...prev, reasoningPart])
                    }

                    // Handle step-finish for cost tracking
                    if (part.type === 'step-finish') {
                      const costInfo = extractCostInfo(event)
                      if (costInfo) {
                        setLastStepCost({
                          cost: costInfo.cost,
                          tokens: {
                            input: costInfo.tokens.input,
                            output: costInfo.tokens.output,
                            reasoning: costInfo.tokens.reasoning,
                            cache: { read: costInfo.tokens.cacheRead, write: costInfo.tokens.cacheWrite },
                          },
                        })
                        setTotalCost((prev) => prev + costInfo.cost)
                        setContextTokens(costInfo.tokens.input + costInfo.tokens.output + costInfo.tokens.reasoning)
                      }
                    }
                    break
                  }

                  case 'status': {
                    const statusInfo = getEventStatus(event)
                    if (statusInfo) {
                      setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                      // Track status for timeline display
                      setStatusEvents((prev) => [
                        ...prev,
                        {
                          status: event.status,
                          message: event.message,
                          time: Date.now(),
                        },
                      ])
                    }
                    break
                  }

                  case 'session.status': {
                    const statusInfo = getEventStatus(event)
                    if (statusInfo) {
                      setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                      // Track session status for timeline display
                      setStatusEvents((prev) => [
                        ...prev,
                        {
                          status: `session-${event.properties.status.type}`,
                          message: statusInfo.label,
                          time: Date.now(),
                        },
                      ])
                    }
                    break
                  }

                  case 'todo.updated': {
                    const todos = event.properties.todos
                    setSessionTodos(todos)
                    if (todos.length > 0) {
                      setThinkingStatus(`📋 Task: ${todos[0].content.slice(0, 40)}`)
                    }
                    break
                  }

                  case 'session.diff': {
                    setFileDiffs(event.properties.diff)
                    break
                  }

                  case 'file-watcher.updated': {
                    const { event: fileEvent, path } = event.properties
                    setThinkingStatus(`📝 ${fileEvent}: ${path.split('/').pop()}`)
                    break
                  }

                  case 'heartbeat': {
                    const statusInfo = getEventStatus(event)
                    if (statusInfo) {
                      setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                    }
                    break
                  }

                  case 'done':
                  case 'session.idle': {
                    setIsStreaming(false)
                    setThinkingStatus('')
                    streamingMessageRef.current = null
                    // Don't clear activity tools immediately - let user see them
                    setTimeout(() => {
                      setActivityTools([])
                      setThinkingParts([])
                      setLastStepCost(null)
                      setReasoningParts([])
                      setStatusEvents([])
                      setOpenCodeUrl('')
                    }, 3000)
                    break
                  }

                  case 'error': {
                    const errorMessage: Message = {
                      id: `error-${Date.now()}`,
                      role: 'system',
                      content: event.error,
                      type: 'error',
                      errorCategory: event.category || 'persistent',
                      retryable: event.retryable || false,
                      createdAt: Math.floor(Date.now() / 1000),
                    }
                    setMessages((prev) => [...prev, errorMessage])
                    setIsStreaming(false)
                    setThinkingStatus('')
                    streamingMessageRef.current = null
                    break
                  }
                }

                // Handle assistant message (non-typed event)
                if (rawData.type === 'assistant') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMessageRef.current
                        ? { ...m, content: rawData.content, id: rawData.id || m.id }
                        : m,
                    ),
                  )
                }

                // Handle PR created (non-typed event)
                if (rawData.prUrl) {
                  const prMessage: Message = {
                    id: `pr-${Date.now()}`,
                    role: 'system',
                    content: `Draft PR created: ${rawData.prUrl}`,
                    type: 'pr-notification',
                    createdAt: Math.floor(Date.now() / 1000),
                  }
                  setMessages((prev) => [...prev, prMessage])
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        console.error('Chat error:', err)

        // Add error message to chat
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: err instanceof Error ? err.message : 'Connection lost. Please refresh and try again.',
          type: 'error',
          errorCategory: 'transient',
          retryable: true,
          createdAt: Math.floor(Date.now() / 1000),
        }

        setMessages((prev) => {
          // Remove the empty assistant placeholder and add error
          const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
          return [...filtered, errorMessage]
        })

        setIsStreaming(false)
        setThinkingStatus('') // Clear "Starting" status on error
        setThinkingParts([]) // Clear thinking parts
        setActivityTools([]) // Clear activity tools
        streamingMessageRef.current = null
      }
    },
    [activeSessionId, isStreaming, mode],
  )

  // Handle stopping the stream
  const handleStop = useCallback(async () => {
    if (!activeSessionId) return
    try {
      await stopChatStream(activeSessionId)
    } catch {
      // Ignore stop errors
    }
    setIsStreaming(false)
    streamingMessageRef.current = null
  }, [activeSessionId])

  // Handle creating a session and starting chat
  const handleCreate = async (data: { repoOwner: string; repoName: string; model?: string }) => {
    try {
      const newSession = await createSession({
        userId,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
        // Use selected model ID directly
        model: data.model || selectedModel?.id || 'kimi-k2.5-free',
      })

      if (newSession) {
        // Add new session to sidebar immediately
        const newSessionData: ChatSession = {
          id: newSession.id,
          userId,
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          status: 'active',
          lastActivity: Math.floor(Date.now() / 1000),
          createdAt: Math.floor(Date.now() / 1000),
          archivedAt: null,
          messageCount: 0,
        }
        setLocalSessions((prev) => [newSessionData, ...prev])

        setActiveSessionId(newSession.id)
        window.history.replaceState({}, '', `/session/${newSession.id}`)
        connectWebSocket(newSession.id)

        const trimmedPrompt = prompt.trim()
        if (trimmedPrompt) {
          // Clear prompt immediately for visual feedback
          const savedPrompt = trimmedPrompt
          setPrompt('')
          // Pass sessionId directly since state hasn't updated yet
          handleSend(savedPrompt, mode, newSession.id)
        }
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Handle submit
  const handleSubmit = () => {
    if (activeSessionId) {
      // In chat mode - send message
      if (!prompt.trim() || isStreaming) return
      const content = prompt.trim()
      setPrompt('')
      handleSend(content, mode)
    } else {
      // On homepage - create session
      if (!selectedRepo || !prompt.trim() || isCreating) return
      handleCreate({
        repoOwner: selectedRepo.owner,
        repoName: selectedRepo.name,
        model: selectedModel?.id,
      })
    }
  }

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Calculate stats
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const recentSessions = localSessions.filter((s) => s.lastActivity > oneWeekAgo)
  const stats = {
    sessionsPastWeek: recentSessions.length,
    messagesPastWeek: recentSessions.reduce((acc, s) => acc + (s.messageCount || 0), 0),
    activeRepos: new Set(localSessions.map((s) => `${s.repoOwner}/${s.repoName}`)).size,
  }

  const humansPrompting = 1
  const sidebarDefaultOpen = !!activeSessionId
  const canSubmit = activeSessionId ? prompt.trim() && !isStreaming : selectedRepo && prompt.trim() && !isCreating

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <AppSidebar
        sessions={localSessions}
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentSessionId={activeSessionId || undefined}
        onSessionDeleted={(sessionId) => {
          setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId))
        }}
      />
      <SidebarInset>
        <div className="flex h-screen flex-col relative overflow-hidden">
          {/* Background - always visible */}
          <DashboardBackground />

          {/* Header */}
          <header className="flex items-center gap-3 px-4 py-3 relative z-10">
            <SidebarTrigger className="cursor-pointer" />

            {activeSessionId && selectedRepo && (
              <div className="flex items-center gap-2 text-sm">
                <HugeiconsIcon icon={GithubIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                <span className="font-medium">{selectedRepo.fullName}</span>
              </div>
            )}

            {activeSessionId && wsStatus !== 'connected' && (
              <div className="ml-auto text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
              </div>
            )}
          </header>

          {/* Main content */}
          <div className="flex-1 flex relative z-10 overflow-hidden">
            {/* Left: Messages + Input */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Messages area */}
              <div
                className={cn(
                  'flex-1 overflow-y-auto',
                  activeSessionId ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden',
                )}
              >
                {activeSessionId && (
                  <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-4">
                    {/* Show loading state when session just started */}
                    {messages.length === 0 && isStreaming && (
                      <div className="flex justify-center py-12 animate-in fade-in-0 duration-500">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-sm">Starting session...</span>
                        </div>
                      </div>
                    )}

                    {messages.map((message) => {
                      // Skip empty assistant messages (we show thinking indicator instead)
                      if (message.role === 'assistant' && !message.content && isStreaming) {
                        return null
                      }

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            'flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
                            message.role === 'user' ? 'justify-end' : 'justify-start',
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-4 py-3',
                              message.role === 'user'
                                ? 'bg-foreground text-background'
                                : message.role === 'system'
                                  ? 'bg-muted/50 text-muted-foreground text-sm'
                                  : 'bg-muted/30',
                            )}
                          >
                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                      )
                    })}

                    {/* Activity feed - show when streaming and we have activity */}
                    {isStreaming && (activityTools.length > 0 || thinkingStatus || statusEvents.length > 0) && (
                      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                        <ActivityFeed
                          tools={activityTools}
                          reasoning={reasoningParts}
                          tokenInfo={lastStepCost?.tokens}
                          cost={lastStepCost?.cost}
                          isStreaming={isStreaming}
                          startTime={streamStartTime || undefined}
                          statusEvents={statusEvents}
                        />
                      </div>
                    )}

                    {/* Fallback to ThinkingIndicator when no typed tools but still streaming */}
                    {isStreaming && messages.length > 0 && activityTools.length === 0 && thinkingParts.length > 0 && (
                      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                        <ThinkingIndicator
                          isThinking={isStreaming}
                          parts={thinkingParts}
                          reasoning={thinkingReasoning}
                          statusLabel={thinkingStatus}
                          expanded={thinkingExpanded}
                          onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                        />
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer - THE SAME ELEMENT that animates position */}
              <div
                className={cn(
                  'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  activeSessionId
                    ? 'mt-auto pb-4 px-6' // Bottom position
                    : 'absolute inset-0 flex items-center justify-center px-6', // Center position
                )}
              >
                <div
                  className={cn(
                    'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    activeSessionId ? 'max-w-3xl mx-auto' : 'max-w-[540px]',
                  )}
                >
                  {/* The actual composer card */}
                  <div className="rounded-3xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden transition-shadow focus-within:shadow-xl focus-within:ring-2 focus-within:ring-foreground/10">
                    <div className="p-4 pb-3">
                      <textarea
                        ref={textareaRef}
                        placeholder={activeSessionId ? 'Send a message...' : 'Ask or build anything'}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={activeSessionId ? 2 : 3}
                        className={cn(
                          'w-full resize-none bg-transparent text-[15px] placeholder:text-muted-foreground/60 focus:outline-none transition-all duration-300',
                          activeSessionId ? 'min-h-[56px]' : 'min-h-[88px]',
                        )}
                      />

                      {/* Bottom controls */}
                      <div className="mt-3 flex items-center justify-between">
                        {/* Left: Add + Repo selector (only on homepage) */}
                        <div className="flex items-center gap-1">
                          {!activeSessionId && (
                            <>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button variant="ghost" size="icon-sm" className="rounded-full">
                                      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent align="start" className="w-[220px]">
                                  <DropdownMenuItem>
                                    <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
                                    Add files
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button variant="ghost" className="h-8 px-3 rounded-full gap-1.5">
                                      <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
                                      <span className="max-w-[150px] truncate text-sm">
                                        {selectedRepo ? selectedRepo.fullName : 'Select repo'}
                                      </span>
                                      <HugeiconsIcon
                                        icon={ArrowDown01Icon}
                                        strokeWidth={2}
                                        className="text-muted-foreground size-3.5"
                                      />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent align="start" className="w-[280px] max-h-[300px] overflow-y-auto">
                                  {reposLoading ? (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      Loading repos...
                                    </div>
                                  ) : repos.length === 0 ? (
                                    <div className="p-3 text-center text-sm text-muted-foreground">No repos found</div>
                                  ) : (
                                    <DropdownMenuGroup>
                                      {repos.slice(0, 20).map((repo) => (
                                        <DropdownMenuItem key={repo.id} onClick={() => setSelectedRepo(repo)}>
                                          <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
                                          <span className="truncate flex-1">{repo.fullName}</span>
                                          {repo.private && (
                                            <span className="text-[10px] text-muted-foreground">private</span>
                                          )}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuGroup>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}

                          {activeSessionId && messageQueue.length > 0 && (
                            <span className="text-[11px] text-muted-foreground ml-2">{messageQueue.length} queued</span>
                          )}
                        </div>

                        {/* Right: Send/Stop */}
                        <div className="flex items-center gap-1">
                          {activeSessionId && isStreaming ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="rounded-full px-3 gap-1.5"
                              onClick={handleStop}
                            >
                              <HugeiconsIcon icon={StopIcon} strokeWidth={2} className="size-3.5" />
                              Stop
                            </Button>
                          ) : (
                            <Button
                              onClick={handleSubmit}
                              disabled={!canSubmit}
                              size="icon-sm"
                              className={cn(
                                'rounded-full transition-all',
                                canSubmit
                                  ? 'bg-foreground text-background hover:bg-foreground/90'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {isCreating ? (
                                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Model + Mode bar (only on homepage) */}
                    {!activeSessionId && (
                      <div className="px-3 py-1.5 flex items-center justify-between border-t border-border/40 bg-muted/30">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                {modelsLoading ? 'Loading...' : selectedModel?.name || 'Select model'}
                                <HugeiconsIcon
                                  icon={ArrowDown01Icon}
                                  strokeWidth={2}
                                  className="text-muted-foreground size-3"
                                />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="start" className="w-[240px]">
                            {Object.entries(groupedByProvider).map(([provider, providerModels], idx) => (
                              <DropdownMenuGroup key={provider}>
                                {idx > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuLabel className="text-xs text-muted-foreground capitalize font-normal">
                                  {provider}
                                </DropdownMenuLabel>
                                <DropdownMenuRadioGroup
                                  value={selectedModel?.id || ''}
                                  onValueChange={(value) => {
                                    const model = providerModels.find((m) => m.id === value)
                                    if (model) setSelectedModel(model)
                                  }}
                                >
                                  {providerModels.map((model) => (
                                    <DropdownMenuRadioItem key={model.id} value={model.id}>
                                      {model.name}
                                    </DropdownMenuRadioItem>
                                  ))}
                                </DropdownMenuRadioGroup>
                              </DropdownMenuGroup>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            onClick={() => setMode('build')}
                            className={cn(
                              'transition-colors cursor-pointer',
                              mode === 'build'
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            build
                          </button>
                          <button
                            onClick={() => setMode('plan')}
                            className={cn(
                              'transition-colors cursor-pointer',
                              mode === 'plan'
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            plan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats + Footer (only on homepage) */}
                  {!activeSessionId && (
                    <div className="mt-6 space-y-6">
                      <DashboardStats stats={stats} />
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>
                            {humansPrompting} {humansPrompting === 1 ? 'human' : 'humans'} prompting
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right panel - SessionPanel (only in chat mode, lg+ screens) */}
            {activeSessionId && (
              <div className="w-64 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden lg:block overflow-y-auto">
                <SessionPanel
                  sessionId={activeSessionId}
                  repo={selectedRepo ? { owner: selectedRepo.owner, name: selectedRepo.name } : undefined}
                  model={
                    selectedModel
                      ? {
                          id: selectedModel.id,
                          name: selectedModel.name,
                          provider: selectedModel.provider,
                          mode: mode,
                        }
                      : undefined
                  }
                  tokens={
                    lastStepCost?.tokens
                      ? {
                          ...lastStepCost.tokens,
                          contextLimit: 200000,
                        }
                      : undefined
                  }
                  cost={totalCost > 0 ? totalCost : undefined}
                  todos={sessionTodos}
                  diffs={fileDiffs}
                  openCodeUrl={openCodeUrl || undefined}
                />
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      <CreateSessionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreate={handleCreate}
        userId={userId}
      />
    </SidebarProvider>
  )
}
