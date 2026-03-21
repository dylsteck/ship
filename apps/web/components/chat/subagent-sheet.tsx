'use client'

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@ship/ui/sheet'
import { ScrollArea } from '@ship/ui/scroll-area'
import { Badge } from '@ship/ui/badge'
import { Tool } from '@ship/ui'
import { Markdown } from './markdown'

interface SubagentSheetProps {
  agentType: string
  description: string
  prompt?: string
  resultText?: string
  childTools?: { name: string; status: string; title?: string }[]
  status?: 'pending' | 'in_progress' | 'completed' | 'failed'
  duration?: number
  isOpen: boolean
  onClose: () => void
}

function StatusBadge({ status }: { status: 'pending' | 'in_progress' | 'completed' | 'failed' }) {
  const config: Record<typeof status, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    in_progress: { variant: 'default', label: 'Running' },
    completed: { variant: 'outline', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
  }
  const { variant, label } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000)
    const secs = ((ms % 60000) / 1000).toFixed(0)
    return `${mins}m ${secs}s`
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function SubagentSheet({
  agentType,
  description,
  prompt,
  resultText,
  childTools,
  status,
  duration,
  isOpen,
  onClose,
}: SubagentSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[90vw] sm:w-[600px] sm:max-w-[600px] p-0">
        <SheetHeader className="border-b px-6 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <SheetTitle className="text-base">{agentType || 'Subagent'}</SheetTitle>
            {status && <StatusBadge status={status} />}
          </div>
          <SheetDescription className="text-xs flex items-center gap-2">
            <span className="truncate">{description}</span>
            {duration !== undefined && duration > 0 && (
              <span className="text-muted-foreground/60 shrink-0">{formatDuration(duration)}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Prompt / Input */}
            {prompt && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt</h4>
                <div className="text-sm text-foreground/80 leading-relaxed rounded-md px-3 py-2.5 bg-muted/15 border border-border/20">
                  {prompt}
                </div>
              </div>
            )}

            {/* Child tools */}
            {childTools && childTools.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tools Used</h4>
                <div className="space-y-1">
                  {childTools.map((tool, i) => (
                    <Tool
                      key={i}
                      name={tool.name}
                      status={tool.status === 'completed' ? 'completed' : tool.status === 'error' || tool.status === 'failed' ? 'failed' : 'completed'}
                      input={tool.title ? { description: tool.title } : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Output / Result */}
            {resultText && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</h4>
                <div className="text-sm text-foreground/80 prose prose-sm dark:prose-invert max-w-none">
                  <Markdown content={resultText} />
                </div>
              </div>
            )}

            {/* No output state */}
            {!resultText && !childTools?.length && status === 'completed' && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Sub-agent completed without output.
              </div>
            )}

            {/* Loading state */}
            {(status === 'pending' || status === 'in_progress') && !resultText && (
              <div className="flex items-center gap-3 py-8 justify-center text-sm text-muted-foreground">
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span>Running...</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
