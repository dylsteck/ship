'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { ChevronDown } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface ToolProps {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: unknown
  duration?: number
  className?: string
}

export function Tool({ name, status, input, output, duration, className }: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const statusColors = {
    pending: 'bg-muted text-muted-foreground border-border',
    in_progress: 'bg-primary/5 text-primary border-primary/20',
    completed: 'bg-green-500/5 text-green-600 border-green-500/20',
    failed: 'bg-red-500/5 text-red-600 border-red-500/20',
  }

  const statusIcons = {
    pending: <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />,
    in_progress: (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
      </span>
    ),
    completed: <span className="w-2 h-2 rounded-full bg-green-500" />,
    failed: <span className="w-2 h-2 rounded-full bg-red-500" />,
  }

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border overflow-hidden my-2', statusColors[status], className)}>
        <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/5 transition-colors">
          <div className="flex items-center gap-2">
            {statusIcons[status]}
            <span className="text-sm font-medium">{name}</span>
            {duration !== undefined && <span className="text-xs opacity-60">({duration}ms)</span>}
          </div>
          <HugeiconsIcon icon={ChevronDown} className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Panel>
          <div className="px-3 pb-3 space-y-2 text-xs">
            {input && Object.keys(input).length > 0 && (
              <div>
                <p className="font-medium mb-1 opacity-70">Input:</p>
                <pre className="bg-black/5 rounded p-2 overflow-x-auto">{JSON.stringify(input, null, 2)}</pre>
              </div>
            )}
            {output !== undefined && (
              <div>
                <p className="font-medium mb-1 opacity-70">Output:</p>
                <pre className="bg-black/5 rounded p-2 overflow-x-auto">
                  {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsiblePrimitive.Panel>
      </div>
    </CollapsiblePrimitive.Root>
  )
}
