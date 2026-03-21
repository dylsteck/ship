'use client'

import { Badge } from '@ship/ui'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { Todo } from './types'
import { TaskItem } from './task-item'

export function TasksSection({ todos, messages }: { todos: Todo[]; messages: UIMessage[] }) {
  const activeTodos = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress')
  const completedTodos = todos.filter((t) => t.status === 'completed' || t.status === 'cancelled')
  const allTodos = [...activeTodos, ...completedTodos]

  if (allTodos.length === 0) return null

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Tasks</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
          {completedTodos.length}/{allTodos.length}
        </Badge>
      </div>
      <div className="space-y-0.5">
        {allTodos.map((todo) => (
          <TaskItem key={todo.id} todo={todo} messages={messages} />
        ))}
      </div>
    </div>
  )
}
