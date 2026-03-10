'use client'

import { useEffect, useRef } from 'react'
import { AIMessageList } from './ai-message-list'
import { EnhancedPromptInput } from './enhanced-prompt-input'
import type { AgentStatus } from '@/components/session/status-indicator'
import { useChatStream } from './use-chat-stream'

interface ChatInterfaceProps {
  sessionId: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
  onOpenCodeUrl?: (url: string) => void
  initialPrompt?: string | null
  initialMode?: string
  agentStatus?: AgentStatus
  currentTool?: string
  sessionInfo?: {
    repoOwner?: string
    repoName?: string
    branch?: string
    model?: string
    modelName?: string
  }
  sandboxId?: string | null
  sandboxStatus?: 'provisioning' | 'ready' | 'error' | 'none'
  opencodeUrl?: string | null
  opencodeSessionId?: string | null
}

export function ChatInterface({
  sessionId,
  onStatusChange,
  onOpenCodeUrl,
  initialPrompt,
  initialMode = 'build',
  agentStatus,
  currentTool,
}: ChatInterfaceProps) {
  const {
    messages,
    isStreaming,
    messageQueue,
    wsStatus,
    streamingMessageId,
    handleSend,
    handleStop,
    handleRetryError,
  } = useChatStream({ sessionId, initialMode, onStatusChange })

  const initialPromptSentRef = useRef(false)

  useEffect(() => {
    if (!initialPrompt || initialPromptSentRef.current) return
    initialPromptSentRef.current = true
    handleSend(initialPrompt, initialMode)
  }, [initialPrompt, initialMode, handleSend])

  // Generate streaming label
  const streamingLabel = isStreaming
    ? (() => {
        const labelMap: Record<AgentStatus, string> = {
          idle: 'Thinking',
          planning: 'Planning',
          coding: 'Coding',
          testing: 'Testing',
          executing: 'Executing',
          stuck: 'Stuck',
          waiting: 'Waiting',
          error: 'Error',
        }
        const base = agentStatus ? labelMap[agentStatus] : 'Thinking'
        return currentTool ? `${base} · ${currentTool}` : `${base}...`
      })()
    : undefined

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Connection status indicator */}
      {wsStatus !== 'connected' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
            {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected - Reconnecting...'}
          </div>
        </div>
      )}

      {/* Message List */}
      <AIMessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingMessageId={streamingMessageId}
        streamingLabel={streamingLabel}
        onRetryError={handleRetryError}
      />

      {/* Input Area */}
      <div className="border-t bg-white dark:bg-background p-3 sm:p-4">
        <div className="max-w-3xl mx-auto">
          <EnhancedPromptInput
            onSend={handleSend}
            isStreaming={isStreaming}
            queueCount={messageQueue.length}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  )
}
