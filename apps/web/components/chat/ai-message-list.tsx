'use client'

import * as React from 'react'
import { Conversation, ConversationScrollButton } from '@ship/ui'
import { cn } from '@ship/ui'
import { SubagentSheet } from './subagent-sheet'
import { type UIMessage, type ToolInvocation, mapToolState } from '@/lib/ai-elements-adapter'
import {
  getSubagentType,
  getSubagentDescription,
  getSubagentFullPrompt,
  getSubagentResultText,
  extractChildToolsFromResult,
} from '@/lib/subagent/utils'
import { AIMessageRow, AIMessageEmptyState } from './ai-message-row'

interface AIMessageListProps {
  messages: UIMessage[]
  isStreaming?: boolean
  streamingMessageId?: string | null
  streamingLabel?: string
  onRetryError?: (messageId: string) => void
  className?: string
}

interface SubagentSheetData {
  isOpen: boolean
  agentType: string
  description: string
  prompt?: string
  resultText?: string
  childTools?: { name: string; status: string; title?: string }[]
  status?: 'pending' | 'in_progress' | 'completed' | 'failed'
  duration?: number
}

function MessageListContent({
  messages,
  isStreaming,
  streamingMessageId,
  streamingLabel,
  onRetryError,
  className,
}: AIMessageListProps) {
  const [sheetData, setSheetData] = React.useState<SubagentSheetData>({ isOpen: false, agentType: '', description: '' })

  const handleSubagentNavigate = React.useCallback((tool: ToolInvocation) => {
    const agentType = getSubagentType(tool) || String(tool.args?.subagent_type || 'Agent')
    const description = getSubagentDescription(tool) || String(tool.args?.description || '')
    const prompt = getSubagentFullPrompt(tool)
    const resultText = getSubagentResultText(tool)
    const childTools = extractChildToolsFromResult(tool)
    const toolStatus = mapToolState(tool.state)

    setSheetData({
      isOpen: true,
      agentType,
      description,
      prompt: prompt || undefined,
      resultText: resultText || undefined,
      childTools: childTools.length > 0 ? childTools : undefined,
      status: toolStatus,
      duration: tool.duration,
    })
  }, [])

  const handleCloseSheet = React.useCallback(() => {
    setSheetData((prev) => ({ ...prev, isOpen: false }))
  }, [])

  if (messages.length === 0 && !isStreaming) {
    return <AIMessageEmptyState />
  }

  return (
    <>
      <Conversation className={cn('flex-1', className)}>
        <div className="max-w-3xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
          {messages.map((msg) => (
            <AIMessageRow
              key={msg.id}
              msg={msg}
              isCurrentlyStreaming={msg.id === streamingMessageId}
              streamingLabel={streamingLabel}
              onRetryError={onRetryError}
              onSubagentNavigate={handleSubagentNavigate}
            />
          ))}
        </div>
        <ConversationScrollButton />
      </Conversation>

      <SubagentSheet
        agentType={sheetData.agentType}
        description={sheetData.description}
        prompt={sheetData.prompt}
        resultText={sheetData.resultText}
        childTools={sheetData.childTools}
        status={sheetData.status}
        duration={sheetData.duration}
        isOpen={sheetData.isOpen}
        onClose={handleCloseSheet}
      />
    </>
  )
}

export function AIMessageList(props: AIMessageListProps) {
  return <MessageListContent {...props} />
}
