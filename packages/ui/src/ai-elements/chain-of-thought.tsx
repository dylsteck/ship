import * as React from 'react'
import { cn } from '../utils'

interface Step {
  id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  description?: string
}

interface ChainOfThoughtProps {
  steps: Step[]
  className?: string
}

export function ChainOfThought({ steps, className }: ChainOfThoughtProps) {
  if (!steps || steps.length === 0) return null

  return (
    <div className={cn('space-y-1 mb-3', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium',
                step.status === 'completed' && 'bg-green-500/10 text-green-600',
                step.status === 'in_progress' && 'bg-primary/10 text-primary',
                step.status === 'pending' && 'bg-muted text-muted-foreground',
                step.status === 'failed' && 'bg-red-500/10 text-red-600',
              )}
            >
              {step.status === 'completed' ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : step.status === 'failed' ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : step.status === 'in_progress' ? (
                <span className="animate-spin">⟳</span>
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && <div className="w-px h-full min-h-[20px] bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-3">
            <p className={cn('text-sm font-medium', step.status === 'pending' && 'text-muted-foreground')}>
              {step.name}
            </p>
            {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
