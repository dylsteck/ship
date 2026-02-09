'use client'

/**
 * Subagent Sheet Component
 *
 * A slide-out panel that displays detailed information about a subagent session,
 * including its messages, tools, and status.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@ship/ui/sheet'
import { Button } from '@ship/ui/button'
import { ScrollArea } from '@ship/ui/scroll-area'
import { Badge } from '@ship/ui/badge'
import { Separator } from '@ship/ui/separator'
import { useSubagent } from '@/lib/subagent/subagent-context'
import type { SubagentSessionInfo } from '@/lib/subagent/types'

interface SubagentSheetProps {
  sessionId?: string
  toolName?: string | null
  isOpen: boolean
  onClose: () => void
}

// Mock data for now - in real implementation, this would fetch from API
function useMockSubagentSession(sessionId: string | undefined): {
  session: SubagentSessionInfo | null
  isLoading: boolean
} {
  const [session, setSession] = React.useState<SubagentSessionInfo | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setIsLoading(false)
      return
    }

    // Simulate API call
    setIsLoading(true)
    const timer = setTimeout(() => {
      setSession({
        id: sessionId,
        parentSessionId: 'parent-123',
        parentToolCallId: 'tool-456',
        subagentType: 'research',
        title: 'Research Task',
        status: 'running',
        progress: {
          currentStep: 3,
          totalSteps: 5,
          currentTool: 'webfetch',
        },
        createdAt: Date.now() - 60000,
        cost: 0.05,
        tokens: {
          input: 1500,
          output: 800,
          reasoning: 200,
        },
      })
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [sessionId])

  return { session, isLoading }
}

function StatusBadge({ status }: { status: SubagentSessionInfo['status'] }) {
  const variants: Record<typeof status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    running: 'default',
    completed: 'outline',
    failed: 'destructive',
    cancelled: 'secondary',
  }

  const labels: Record<typeof status, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export function SubagentSheet({ sessionId, toolName, isOpen, onClose }: SubagentSheetProps) {
  const router = useRouter()
  const { session, isLoading } = useMockSubagentSession(sessionId)

  const handleOpenInSession = () => {
    if (sessionId) {
      router.push(`/session/${sessionId}`)
      onClose()
    }
  }

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
            <SheetTitle className="text-base">Subagent Session</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {toolName || 'Task'} • {sessionId ? sessionId.slice(0, 8) : ''}...
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
              </div>
            ) : session ? (
              <>
                {/* Status Card */}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <StatusBadge status={session.status} />
                  </div>

                  {session.progress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>
                          Step {session.progress.currentStep} of {session.progress.totalSteps}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${(session.progress.currentStep / session.progress.totalSteps) * 100}%`,
                          }}
                        />
                      </div>
                      {session.progress.currentTool && (
                        <p className="text-xs text-muted-foreground">Currently: {session.progress.currentTool}</p>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Created</span>
                      <p className="font-medium">{formatDuration(Date.now() - session.createdAt)} ago</p>
                    </div>
                    {session.cost && (
                      <div>
                        <span className="text-muted-foreground">Cost</span>
                        <p className="font-medium">${session.cost.toFixed(4)}</p>
                      </div>
                    )}
                  </div>

                  {session.tokens && (
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                      <div className="bg-muted/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">Input</span>
                        <p className="font-medium">{session.tokens.input.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">Output</span>
                        <p className="font-medium">{session.tokens.output.toLocaleString()}</p>
                      </div>
                      {session.tokens.reasoning && (
                        <div className="bg-muted/50 rounded px-2 py-1">
                          <span className="text-muted-foreground">Reasoning</span>
                          <p className="font-medium">{session.tokens.reasoning.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tools Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Tool Executions</h4>
                  <div className="space-y-2">
                    {['webfetch', 'grep', 'read'].map((tool, i) => (
                      <div key={tool} className="flex items-center gap-3 p-2 rounded-md border bg-card/50 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="font-medium capitalize">{tool}</span>
                        <span className="text-muted-foreground ml-auto">{i === 0 ? 'Running...' : 'Completed'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messages Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Recent Activity</h4>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>Researching topic...</p>
                    <p>Found 3 relevant sources</p>
                    <p>Analyzing content...</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No session data available</div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" className="w-full" onClick={handleOpenInSession} disabled={!sessionId}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in Session View
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
