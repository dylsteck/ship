'use client'

import React from 'react'
import { Tool, SubagentTool, TodoProgress } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import type { ToolInvocation } from '@/lib/ai-elements-adapter'
import { mapToolState } from '@/lib/ai-elements-adapter'
import { collapseToolInvocations, type CollapsedToolInvocation } from '@/lib/session-logic'
import {
  isSubagentToolInvocation,
  getSubagentType,
  getSubagentDescription,
  getSubagentResultText,
  extractChildToolsFromResult,
  isResultJsonBlob,
} from '@/lib/subagent/utils'
import type { TodoItem } from '../../types'

interface MessageToolListProps {
  tools: ToolInvocation[]
  sessionTodos: TodoItem[]
  todoRenderedRef: React.MutableRefObject<boolean>
  onSubagentNavigate: (tool: ToolInvocation) => void
}

function renderSingleTool(
  tool: ToolInvocation,
  sessionTodos: TodoItem[],
  todoRenderedRef: React.MutableRefObject<boolean>,
  onSubagentNavigate: (tool: ToolInvocation) => void,
) {
  const isTodoTool = tool.toolName.toLowerCase().includes('todo')
  if (isTodoTool && sessionTodos.length > 0 && !todoRenderedRef.current) {
    if (tool.toolName.toLowerCase().includes('todoread')) return null
    todoRenderedRef.current = true
    return <TodoProgress key={tool.toolCallId} todos={sessionTodos} />
  }
  if (isTodoTool) return null

  const isSubagent = isSubagentToolInvocation(tool)
  if (isSubagent) {
    const agentType =
      getSubagentType(tool) || String(tool.args?.subagent_type ?? tool.args?.description ?? 'Agent')
    const description =
      getSubagentDescription(tool) || String(tool.args?.prompt ?? tool.args?.description ?? '')
    const childTools = extractChildToolsFromResult(tool)
    const resultText = getSubagentResultText(tool)
    const toolStatus = mapToolState(tool.state)
    const showResult = resultText && !(toolStatus === 'completed' && isResultJsonBlob(tool))
    return (
      <SubagentTool
        key={tool.toolCallId}
        toolCallId={tool.toolCallId}
        agentType={agentType}
        description={description}
        status={toolStatus}
        duration={tool.duration}
        childTools={childTools.length > 0 ? childTools : undefined}
        result={showResult ? <Markdown content={resultText!} /> : undefined}
        onNavigate={() => onSubagentNavigate(tool)}
      />
    )
  }

  return (
    <Tool
      key={tool.toolCallId}
      name={tool.toolName}
      status={mapToolState(tool.state)}
      input={tool.args}
      output={tool.result}
      duration={tool.duration}
      compact
    />
  )
}

function renderCollapsedEntry(
  entry: CollapsedToolInvocation,
  sessionTodos: TodoItem[],
  todoRenderedRef: React.MutableRefObject<boolean>,
  onSubagentNavigate: (tool: ToolInvocation) => void,
  key: string,
) {
  if (entry.kind === 'group') {
    const representative = entry.tools[0]
    const allCompleted = entry.tools.every((t) => t.state === 'result' || t.state === 'error')
    return (
      <Tool
        key={key}
        name={entry.label}
        status={allCompleted ? 'completed' : 'in_progress'}
        input={{ tools: entry.tools.map((t) => t.toolName) }}
        output={entry.tools.length > 1 ? `${entry.tools.length} operations` : representative.result}
        compact
      />
    )
  }

  return renderSingleTool(entry.tool, sessionTodos, todoRenderedRef, onSubagentNavigate)
}

export const MessageToolList = React.memo(function MessageToolList({
  tools,
  sessionTodos,
  todoRenderedRef,
  onSubagentNavigate,
}: MessageToolListProps) {
  const collapsed = collapseToolInvocations(tools)

  return (
    <div className="space-y-1">
      {collapsed.map((entry, index) =>
        renderCollapsedEntry(
          entry,
          sessionTodos,
          todoRenderedRef,
          onSubagentNavigate,
          entry.kind === 'group' ? `group-${index}` : entry.tool.toolCallId,
        ),
      )}
    </div>
  )
})
