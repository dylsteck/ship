'use client'

import * as React from 'react'
import { useEffect, useState, useMemo } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
  Progress,
  ScrollArea,
  Separator,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Skeleton,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import type { SessionInfo as SSESessionInfo, SessionDiffEvent, TodoUpdatedEvent, StepFinishPart } from '@/lib/sse-types'

// ============ Types ============

interface RepoInfo {
  owner: string
  name: string
  branch?: string
}

interface ModelInfo {
  id: string
  name?: string
  provider?: string
  mode?: 'build' | 'plan'
}

interface TokenInfo {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
  contextLimit?: number
}

interface DiffSummary {
  filename: string
  additions: number
  deletions: number
}

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

interface SessionPanelProps {
  sessionId: string
  repo?: RepoInfo
  model?: ModelInfo
  tokens?: TokenInfo
  cost?: number
  todos?: Todo[]
  diffs?: DiffSummary[]
  sessionInfo?: SSESessionInfo
  className?: string
}

// ============ Sub-components ============

// Repository info section
function RepoSection({ repo }: { repo: RepoInfo }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📁</span>
          <CardTitle className="text-xs uppercase text-muted-foreground">Repository</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="font-medium text-sm">
          {repo.owner}/{repo.name}
        </div>
        {repo.branch && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-muted-foreground text-xs">🔀</span>
            <span className="text-xs font-mono text-muted-foreground">{repo.branch}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Model and mode section
function ModelSection({ model }: { model: ModelInfo }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <CardTitle className="text-xs uppercase text-muted-foreground">Model</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{model.name || model.id}</span>
          </div>
          {model.mode && (
            <Badge variant={model.mode === 'build' ? 'default' : 'outline'} className="text-[0.625rem]">
              {model.mode}
            </Badge>
          )}
        </div>
        {model.provider && <div className="text-xs text-muted-foreground mt-1">via {model.provider}</div>}
      </CardContent>
    </Card>
  )
}

// Context token usage section
function ContextUsageSection({ tokens, cost }: { tokens: TokenInfo; cost?: number }) {
  const totalTokens = tokens.input + tokens.output + tokens.reasoning
  const contextLimit = tokens.contextLimit || 200000
  const usagePercent = Math.min((totalTokens / contextLimit) * 100, 100)

  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <CardTitle className="text-xs uppercase text-muted-foreground">Context</CardTitle>
          </div>
          {cost !== undefined && cost > 0 && (
            <Badge variant="outline" className="font-mono text-[0.625rem]">
              ${cost.toFixed(4)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Usage</span>
            <span className="font-mono">
              {totalTokens.toLocaleString()} / {contextLimit.toLocaleString()}
            </span>
          </div>
          <Progress
            value={usagePercent}
            className={cn(
              'h-2',
              usagePercent > 80 && '[&>div]:bg-red-500',
              usagePercent > 60 && usagePercent <= 80 && '[&>div]:bg-yellow-500',
            )}
          />
        </div>

        {/* Token breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-muted-foreground">Input</div>
            <div className="font-mono font-medium">{tokens.input.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Output</div>
            <div className="font-mono font-medium">{tokens.output.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Think</div>
            <div className="font-mono font-medium">{tokens.reasoning.toLocaleString()}</div>
          </div>
        </div>

        {/* Cache info */}
        {(tokens.cache.read > 0 || tokens.cache.write > 0) && (
          <div className="flex items-center justify-center gap-3 text-xs pt-1 border-t">
            {tokens.cache.read > 0 && (
              <span className="text-muted-foreground">
                Cache ↓{' '}
                <span className="text-green-600 dark:text-green-400 font-mono">
                  {tokens.cache.read.toLocaleString()}
                </span>
              </span>
            )}
            {tokens.cache.write > 0 && (
              <span className="text-muted-foreground">
                Cache ↑{' '}
                <span className="text-blue-600 dark:text-blue-400 font-mono">
                  {tokens.cache.write.toLocaleString()}
                </span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Todo list section
function TodoSection({ todos }: { todos: Todo[] }) {
  const [isOpen, setIsOpen] = useState(true)

  const groupedTodos = useMemo(() => {
    const pending = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress')
    const completed = todos.filter((t) => t.status === 'completed')
    const cancelled = todos.filter((t) => t.status === 'cancelled')
    return { pending, completed, cancelled }
  }, [todos])

  const priorityColors: Record<Todo['priority'], string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-muted-foreground',
  }

  const statusIcons: Record<Todo['status'], string> = {
    pending: '○',
    in_progress: '◐',
    completed: '●',
    cancelled: '✕',
  }

  if (todos.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card size="sm">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <CardTitle className="text-xs uppercase text-muted-foreground">
                  Todos ({groupedTodos.pending.length} active)
                </CardTitle>
              </div>
              <span className="text-muted-foreground text-xs">{isOpen ? '▼' : '▶'}</span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {/* Active todos */}
                {groupedTodos.pending.map((todo) => (
                  <div key={todo.id} className="flex items-start gap-2 text-xs">
                    <span className={cn('mt-0.5', priorityColors[todo.priority])}>{statusIcons[todo.status]}</span>
                    <span className={todo.status === 'in_progress' ? 'font-medium' : ''}>{todo.content}</span>
                  </div>
                ))}

                {/* Completed todos */}
                {groupedTodos.completed.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="text-xs text-muted-foreground mb-1">
                      Completed ({groupedTodos.completed.length})
                    </div>
                    {groupedTodos.completed.slice(-3).map((todo) => (
                      <div key={todo.id} className="flex items-start gap-2 text-xs text-muted-foreground line-through">
                        <span className="mt-0.5 text-green-600 dark:text-green-400">●</span>
                        <span>{todo.content}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// File changes/diffs section
function DiffSection({ diffs }: { diffs: DiffSummary[] }) {
  const [isOpen, setIsOpen] = useState(false)

  const totalChanges = useMemo(() => {
    return diffs.reduce(
      (acc, diff) => ({
        additions: acc.additions + diff.additions,
        deletions: acc.deletions + diff.deletions,
        files: acc.files + 1,
      }),
      { additions: 0, deletions: 0, files: 0 },
    )
  }, [diffs])

  if (diffs.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card size="sm">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <CardTitle className="text-xs uppercase text-muted-foreground">Changes</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[0.625rem] font-mono">
                  {totalChanges.files} files
                </Badge>
                <span className="text-xs text-green-600 dark:text-green-400 font-mono">+{totalChanges.additions}</span>
                <span className="text-xs text-red-600 dark:text-red-400 font-mono">-{totalChanges.deletions}</span>
                <span className="text-muted-foreground text-xs">{isOpen ? '▼' : '▶'}</span>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {diffs.map((diff, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1">
                    <span className="font-mono truncate flex-1 mr-2" title={diff.filename}>
                      {diff.filename.split('/').pop()}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-green-600 dark:text-green-400 font-mono">+{diff.additions}</span>
                      <span className="text-red-600 dark:text-red-400 font-mono">-{diff.deletions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// Session info summary
function SessionSummary({ sessionInfo }: { sessionInfo: SSESessionInfo }) {
  return (
    <Card size="sm" className="border-dashed">
      <CardContent className="py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Session</span>
          <span className="font-mono">{sessionInfo.id.slice(0, 8)}...</span>
        </div>
        {sessionInfo.title && (
          <div className="mt-1 text-sm font-medium truncate" title={sessionInfo.title}>
            {sessionInfo.title}
          </div>
        )}
        {sessionInfo.summary && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{sessionInfo.summary.files} files</span>
            <span className="text-green-600 dark:text-green-400">+{sessionInfo.summary.additions}</span>
            <span className="text-red-600 dark:text-red-400">-{sessionInfo.summary.deletions}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ Main Component ============

export function SessionPanel({
  sessionId,
  repo,
  model,
  tokens,
  cost,
  todos,
  diffs,
  sessionInfo,
  className,
}: SessionPanelProps) {
  return (
    <div className={cn('space-y-3 p-3', className)}>
      {/* Repository info */}
      {repo && <RepoSection repo={repo} />}

      {/* Model info */}
      {model && <ModelSection model={model} />}

      {/* Context/token usage */}
      {tokens && <ContextUsageSection tokens={tokens} cost={cost} />}

      {/* Todo list */}
      {todos && todos.length > 0 && <TodoSection todos={todos} />}

      {/* File changes */}
      {diffs && diffs.length > 0 && <DiffSection diffs={diffs} />}

      {/* Session summary */}
      {sessionInfo && <SessionSummary sessionInfo={sessionInfo} />}

      {/* Empty state */}
      {!repo && !model && !tokens && !todos?.length && !diffs?.length && !sessionInfo && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>No session data</p>
        </div>
      )}
    </div>
  )
}

// ============ Exports ============

export type { SessionPanelProps, RepoInfo, ModelInfo, TokenInfo, DiffSummary, Todo }
