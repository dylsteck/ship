'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

interface TodoProgressProps {
  todos: TodoItem[]
  className?: string
}

function TodoStatusIcon({ status }: { status: TodoItem['status'] }) {
  if (status === 'completed') {
    return (
      <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="relative flex h-4 w-4 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
        <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-primary/30 border-t-primary animate-spin" />
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    )
  }
  // pending
  return <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
}

export function TodoProgress({ todos, className }: TodoProgressProps) {
  const [isOpen, setIsOpen] = React.useState(true)

  const completedCount = todos.filter((t) => t.status === 'completed').length
  const totalCount = todos.length

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border border-border/30 bg-muted/40 overflow-hidden', className)}>
        <CollapsiblePrimitive.Trigger className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted/60 transition-colors min-h-[36px]">
          {/* Checklist icon */}
          <svg
            className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="text-sm font-medium text-foreground/90 shrink-0">To-dos</span>
          <span className="text-xs text-muted-foreground/50">
            {completedCount}/{totalCount} completed
          </span>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {completedCount === totalCount && totalCount > 0 ? (
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-green-500" />
            ) : completedCount > 0 ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            ) : null}
            <svg
              className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', !isOpen && '-rotate-90')}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Panel>
          <div className="border-t border-border/30 px-4 py-3 space-y-2">
            {todos.map((todo) => (
              <div key={todo.id} className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  <TodoStatusIcon status={todo.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-sm',
                      todo.status === 'completed'
                        ? 'text-muted-foreground line-through'
                        : todo.status === 'cancelled'
                          ? 'text-muted-foreground/50 line-through'
                          : 'text-foreground/90',
                    )}
                  >
                    {todo.content}
                  </span>
                  {todo.priority === 'high' && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-medium">
                      high
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsiblePrimitive.Panel>
      </div>
    </CollapsiblePrimitive.Root>
  )
}
