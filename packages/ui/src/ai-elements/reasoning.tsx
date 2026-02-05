'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { ChevronDown } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface ReasoningProps {
  children: React.ReactNode
  isStreaming?: boolean
  className?: string
}

export function Reasoning({ children, isStreaming = false, className }: ReasoningProps) {
  const [isOpen, setIsOpen] = React.useState(isStreaming)

  React.useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    } else if (!isStreaming && isOpen) {
      const timer = setTimeout(() => setIsOpen(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isStreaming])

  if (!children) return null

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <CollapsiblePrimitive.Trigger
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2',
          className,
        )}
      >
        <HugeiconsIcon icon={ChevronDown} className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        <span className="flex items-center gap-2">
          {isStreaming ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60"></span>
              </span>
              Thinking...
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              Reasoning
            </>
          )}
        </span>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel>
        <div className="pl-4 border-l-2 border-border/50 text-sm text-muted-foreground mb-3 space-y-2">{children}</div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}
