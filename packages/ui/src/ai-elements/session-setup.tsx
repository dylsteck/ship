'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Shimmer } from './shimmer'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible'

interface SessionSetupProps {
  steps: string[]
  isStreaming?: boolean
  defaultOpen?: boolean
  className?: string
}

function getSessionSetupLabel(isStreaming: boolean): React.ReactNode {
  if (isStreaming) {
    return <Shimmer>Session setup</Shimmer>
  }
  return 'Session setup'
}

export function SessionSetup({
  steps,
  isStreaming = false,
  defaultOpen = false,
  className,
}: SessionSetupProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  if (!steps.length) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('overflow-hidden', className)}
    >
      <CollapsibleTrigger className="w-full flex items-center gap-2 py-1.5 -mx-1 px-1 rounded text-left group/trigger">
        <span
          className={cn(
            'text-sm text-muted-foreground shrink-0',
            isStreaming && 'animate-pulse',
          )}
        >
          {getSessionSetupLabel(isStreaming)}
        </span>
        <svg
          className={cn('w-4 h-4 shrink-0 text-muted-foreground/80 transition-transform', !open && '-rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-5 pr-1 py-2 space-y-1.5">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {steps.map((step, i) => (
              <li key={i} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
