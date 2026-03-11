'use client'

import { Tool, SubagentTool, TodoProgress } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import type { ToolInvocation } from '@/lib/ai-elements-adapter'
import { mapToolState } from '@/lib/ai-elements-adapter'
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

export function MessageToolList({
  tools,
  sessionTodos,
  todoRenderedRef,
  onSubagentNavigate,
}: MessageToolListProps) {
  return (
    <div className="space-y-1">
      {tools.map((tool) => {
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
            getSubagentType(tool) ||
            String(tool.args?.subagent_type ?? tool.args?.description ?? 'Agent')
          const description =
            getSubagentDescription(tool) ||
            String(tool.args?.prompt ?? tool.args?.description ?? '')
          const childTools = extractChildToolsFromResult(tool)
          const resultText = getSubagentResultText(tool)
          const toolStatus = mapToolState(tool.state)
          // When completed, hide raw JSON blob — user clicks "View →" to see session
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
      })}
    </div>
  )
}
