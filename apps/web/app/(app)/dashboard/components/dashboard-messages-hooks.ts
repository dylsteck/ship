'use client'

import * as React from 'react'
import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'
import { getStreamingStatus, mapToolState } from '@/lib/ai-elements-adapter'
import {
  extractSubagentSessionId,
  getSubagentType,
  getSubagentDescription,
  getSubagentFullPrompt,
  getSubagentResultText,
  extractChildToolsFromResult,
} from '@/lib/subagent/utils'
import { formatAgentType } from './messages/helpers'
import type { SubagentViewState } from './subagent-view'

export function useSubagentStack(messages: UIMessage[]) {
  const [subagentStack, setSubagentStack] = React.useState<SubagentViewState[]>([])

  const resolvedSubagent = React.useMemo(() => {
    if (subagentStack.length === 0) return null
    const stackTop = subagentStack[subagentStack.length - 1]!
    const toolCallId = stackTop.toolCallId

    let latestTool: ToolInvocation | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const tools = msg?.toolInvocations ?? []
      const found = tools.find((t) => t.toolCallId === toolCallId)
      if (found) {
        latestTool = found
        break
      }
    }

    if (!latestTool) return stackTop

    const sessionId = extractSubagentSessionId(latestTool) || stackTop.sessionId
    const resultText = getSubagentResultText(latestTool) || stackTop.resultText
    const childTools = extractChildToolsFromResult(latestTool)
    const toolStatus = mapToolState(latestTool.state)

    return {
      ...stackTop,
      sessionId: sessionId || stackTop.sessionId,
      resultText: resultText || stackTop.resultText,
      childTools: childTools.length > 0 ? childTools : stackTop.childTools,
      toolStatus,
      duration: latestTool.duration ?? stackTop.duration,
    }
  }, [subagentStack, messages])

  const handleSubagentNavigate = React.useCallback((tool: ToolInvocation) => {
    const agentType = getSubagentType(tool) || String(tool.args?.subagent_type || 'Agent')
    const description = getSubagentDescription(tool) || String(tool.args?.description || '')
    const prompt = getSubagentFullPrompt(tool)
    const sessionId = extractSubagentSessionId(tool) || undefined
    const resultText = getSubagentResultText(tool) || undefined
    const childTools = extractChildToolsFromResult(tool)
    const toolStatus = mapToolState(tool.state)

    setSubagentStack((prev) => [
      ...prev,
      {
        toolCallId: tool.toolCallId,
        agentType: formatAgentType(agentType),
        description,
        prompt: prompt || undefined,
        resultText,
        sessionId,
        childTools: childTools.length > 0 ? childTools : undefined,
        toolStatus,
        duration: tool.duration,
      },
    ])
  }, [])

  const handleSubagentBack = React.useCallback(() => {
    setSubagentStack((prev) => prev.slice(0, -1))
  }, [])

  return { resolvedSubagent, handleSubagentNavigate, handleSubagentBack }
}

export function useMessageGroupMeta(
  messages: UIMessage[],
  streamingMessageId: string | null,
  messageGroups: Array<{ type: string }>,
) {
  return React.useMemo(() => {
    const hasCompletedAssistant = messages.some(
      (m) =>
        m.role === 'assistant' && m.id !== streamingMessageId && (m.content || (m.toolInvocations?.length ?? 0) > 0),
    )
    let firstIdx = -1
    for (let i = 0; i < messageGroups.length; i++) {
      if (messageGroups[i].type === 'assistant-run') {
        firstIdx = i
        break
      }
    }
    return {
      showSessionSetup: !hasCompletedAssistant,
      firstAssistantBlockIndex: firstIdx,
    }
  }, [messages, streamingMessageId, messageGroups])
}

export function getActiveStatusLabel(
  isStreaming: boolean,
  messages: UIMessage[],
  streamingMessageId: string | null,
  streamingStatus: string,
): string {
  return isStreaming ? getStreamingStatus(messages, streamingMessageId) || streamingStatus : ''
}
