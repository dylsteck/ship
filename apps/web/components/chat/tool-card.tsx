'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ScrollArea,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Button,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import type { ToolState } from '@/lib/sse-types'

// Tool icon mapping based on tool name
const TOOL_ICONS: Record<string, string> = {
  read: '📄',
  Read: '📄',
  write: '✏️',
  Write: '✏️',
  edit: '📝',
  Edit: '📝',
  bash: '💻',
  Bash: '💻',
  glob: '🔍',
  Glob: '🔍',
  grep: '🔎',
  Grep: '🔎',
  webfetch: '🌐',
  websearch: '🔎',
  codesearch: '📚',
  gh_grep_searchGitHub: '🐙',
  skill: '🎯',
  default: '🔧',
}

// Status badge variants
const STATUS_CONFIG: Record<
  ToolState['status'],
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }
> = {
  pending: { variant: 'outline', label: 'Pending', className: 'text-muted-foreground' },
  running: { variant: 'default', label: 'Running', className: 'animate-pulse bg-blue-500' },
  completed: {
    variant: 'secondary',
    label: 'Complete',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  error: { variant: 'destructive', label: 'Error' },
}

interface ToolCardProps {
  id: string
  tool: string
  state: ToolState
  className?: string
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function getToolIcon(toolName: string): string {
  // Try exact match first
  if (TOOL_ICONS[toolName]) return TOOL_ICONS[toolName]

  // Try lowercase match
  const lowerName = toolName.toLowerCase()
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lowerName.includes(key.toLowerCase())) return icon
  }

  return TOOL_ICONS.default
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={handleCopy}
        className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
      >
        {copied ? (
          <span className="text-green-500 text-sm">✓</span>
        ) : (
          <span className="text-muted-foreground text-sm">📋</span>
        )}
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}

export function ToolCard({ id, tool, state, className }: ToolCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const statusConfig = STATUS_CONFIG[state.status]
  const icon = getToolIcon(tool)

  // Calculate duration if timing info available
  const duration = useMemo(() => {
    if (!state.time?.start) return null
    const endTime = state.time.end || Date.now()
    return endTime - state.time.start
  }, [state.time])

  // Format input for display
  const formattedInput = useMemo(() => {
    if (!state.input) return null
    try {
      return JSON.stringify(state.input, null, 2)
    } catch {
      return String(state.input)
    }
  }, [state.input])

  // Format output for display
  const formattedOutput = useMemo(() => {
    if (!state.output) return null
    // Output is usually a string
    return state.output
  }, [state.output])

  const hasContent = formattedInput || formattedOutput

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        size="sm"
        className={cn(
          'transition-all duration-200',
          state.status === 'running' && 'ring-2 ring-blue-500/50',
          state.status === 'error' && 'ring-2 ring-red-500/50',
          className,
        )}
      >
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-lg" role="img" aria-label={tool}>
                  {icon}
                </span>
                <CardTitle className="text-sm font-mono">{state.title || tool}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {duration !== null && state.status !== 'pending' && (
                  <span className="text-xs text-muted-foreground font-mono">{formatDuration(duration)}</span>
                )}
                <Badge variant={statusConfig.variant} className={cn('text-[0.625rem]', statusConfig.className)}>
                  {statusConfig.label}
                </Badge>
                <span className="text-muted-foreground text-xs">{isOpen ? '▼' : '▶'}</span>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {hasContent && (
            <CardContent className="pt-0">
              <Tabs defaultValue={formattedOutput ? 'output' : 'input'} className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <TabsList className="h-7">
                    {formattedInput && (
                      <TabsTrigger value="input" className="text-xs px-2 py-1">
                        Input
                      </TabsTrigger>
                    )}
                    {formattedOutput && (
                      <TabsTrigger value="output" className="text-xs px-2 py-1">
                        Output
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>

                {formattedInput && (
                  <TabsContent value="input" className="mt-0">
                    <div className="relative">
                      <div className="absolute right-2 top-2 z-10">
                        <CopyButton content={formattedInput} />
                      </div>
                      <ScrollArea className="h-[200px] rounded-md border bg-muted/30">
                        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">{formattedInput}</pre>
                      </ScrollArea>
                    </div>
                  </TabsContent>
                )}

                {formattedOutput && (
                  <TabsContent value="output" className="mt-0">
                    <div className="relative">
                      <div className="absolute right-2 top-2 z-10">
                        <CopyButton content={formattedOutput} />
                      </div>
                      <ScrollArea className="h-[200px] rounded-md border bg-muted/30">
                        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">{formattedOutput}</pre>
                      </ScrollArea>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export type { ToolCardProps }
