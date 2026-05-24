import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'
import type { Todo } from '@/components/chat/session-panel/types'

export function findRelatedTools(todo: Todo, messages: UIMessage[]): ToolInvocation[] {
  const todoLower = todo.content.toLowerCase()
  const related: ToolInvocation[] = []
  for (const msg of messages) {
    if (!msg.toolInvocations) continue
    for (const tool of msg.toolInvocations) {
      const name = tool.toolName.toLowerCase()
      if (name.includes('task') || name.includes('agent')) {
        const argsStr = JSON.stringify(tool.args || {}).toLowerCase()
        if (argsStr.includes(todoLower.slice(0, 30)) || todoLower.includes(name)) {
          related.push(tool)
          continue
        }
        related.push(tool)
      }
    }
  }
  return related
}
