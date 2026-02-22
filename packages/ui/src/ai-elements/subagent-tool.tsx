'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

interface SubagentToolProps {
  toolCallId: string
  agentType: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  duration?: number
  result?: React.ReactNode
  childTools?: { name: string; status: string; title?: string }[]
  onNavigate?: (toolCallId: string) => void
  className?: string
}

function AgentIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ChildToolIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase()
  const iconClass = 'w-3 h-3 shrink-0 text-muted-foreground/50'

  if (lowerName.includes('read')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="11" r="4.5" /><circle cx="17.5" cy="11" r="4.5" /><path d="M11 11h2" /><path d="M2 11h0" /><path d="M22 11h0" />
      </svg>
    )
  }
  if (lowerName.includes('bash') || lowerName.includes('shell')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  }
  if (lowerName.includes('glob') || lowerName.includes('search') || lowerName.includes('grep')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
      </svg>
    )
  }
  if (lowerName.includes('write') || lowerName.includes('edit')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    )
  }
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function formatAgentType(raw: string): string {
  if (!raw) return 'Agent'
  return raw
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function SubagentTool({
  toolCallId,
  agentType,
  description,
  status,
  duration,
  result,
  childTools,
  onNavigate,
  className,
}: SubagentToolProps) {
  const [isOpen, setIsOpen] = React.useState(status === 'in_progress')

  // Auto-open when in_progress
  React.useEffect(() => {
    if (status === 'in_progress') {
      setIsOpen(true)
    }
  }, [status])

  const durationLabel = duration !== undefined
    ? (duration >= 60000 ? `${Math.floor(duration / 60000)}m ${((duration % 60000) / 1000).toFixed(0)}s` : duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`)
    : null

  const formattedType = formatAgentType(agentType)
  const hasExpandContent = (childTools && childTools.length > 0) || result

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('group/tool', className)}>
        <div className="flex items-stretch">
          <CollapsiblePrimitive.Trigger
            className={cn(
              'flex-1 flex items-center gap-2 py-1 -mx-1 px-1 rounded hover:bg-muted/40 transition-colors text-left min-w-0',
            )}
          >
            <AgentIcon />
            <span className="text-sm font-medium text-foreground/90 shrink-0">{formattedType}</span>
            <span className="text-xs text-muted-foreground/50 truncate font-mono">{description}</span>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {durationLabel && (
                <span className="text-xs text-muted-foreground/60">{durationLabel}</span>
              )}
              {hasExpandContent ? (
                <svg
                  className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', isOpen && 'rotate-180')}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              ) : onNavigate ? (
                <svg
                  className="w-3.5 h-3.5 text-muted-foreground/40"
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              ) : null}
            </div>
          </CollapsiblePrimitive.Trigger>
          {onNavigate && (
            <button
              type="button"
              className="shrink-0 self-center p-1 rounded hover:bg-muted/40 transition-colors text-muted-foreground/50 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onNavigate(toolCallId)
              }}
              title="View full session"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Expanded content: child tools + result */}
        {hasExpandContent && (
          <CollapsiblePrimitive.Panel>
            <div className="pl-5 pr-2 py-2 border-l border-border/30 ml-1.5 space-y-3 text-[11px]">
              {/* Child tools list */}
              {childTools && childTools.length > 0 && (
                <div className="space-y-1">
                  {childTools.map((tool, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <ChildToolIcon name={tool.name} />
                      <span className="text-xs font-medium text-muted-foreground/70">{tool.name}</span>
                      {tool.title && (
                        <span className="text-xs text-muted-foreground/40 truncate">{tool.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Result content */}
              {result && (
                <div className={cn(childTools && childTools.length > 0 && 'border-t border-border/30 pt-3')}>
                  <div className="text-sm text-foreground/80">{result}</div>
                </div>
              )}
            </div>
          </CollapsiblePrimitive.Panel>
        )}
      </div>
    </CollapsiblePrimitive.Root>
  )
}
