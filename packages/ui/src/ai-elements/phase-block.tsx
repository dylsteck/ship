'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

export interface PhaseBlockProps {
  /** Phase label (e.g. "Exploring", "Tracing session title") */
  label: string
  /** Duration string (e.g. "1s", "2.5s") */
  duration?: string
  /** Show checkmark when phase is complete */
  isComplete?: boolean
  children: React.ReactNode
  className?: string
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function PhaseBlock({
  label,
  duration,
  isComplete = false,
  children,
  className,
}: PhaseBlockProps) {
  const [isOpen, setIsOpen] = React.useState(true)

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'rounded-lg border border-border/30 bg-muted/40 overflow-hidden',
          className,
        )}
      >
        <CollapsiblePrimitive.Trigger
          className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted/60 transition-colors min-h-[36px] text-left"
        >
          <span className="text-sm font-medium text-foreground/90 shrink-0">{label}</span>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {duration && (
              <span className="text-xs text-muted-foreground/60">{duration}</span>
            )}
            {isComplete && <CheckIcon />}
            <svg
              className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', !isOpen && '-rotate-90')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Panel>
          <div className="border-t border-border/30 px-4 py-3 space-y-2">
            {children}
          </div>
        </CollapsiblePrimitive.Panel>
      </div>
    </CollapsiblePrimitive.Root>
  )
}
