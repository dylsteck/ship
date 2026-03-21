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
      {/* Message List */}
      <AIMessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingMessageId={streamingMessageId}
        streamingLabel={streamingLabel}
        onRetryError={handleRetryError}
      />

      {/* Input Area */}
      <div className="bg-white dark:bg-background px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
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
