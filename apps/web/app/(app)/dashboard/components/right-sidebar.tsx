'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@ship/ui'
import { SessionPanel } from '@/components/chat/session-panel'
import type { SessionInfo } from '@/lib/sse-types'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { GitHubRepo, ModelInfo } from '@/lib/api'
import type { TodoItem } from '../hooks/use-task-detail-sheet'

interface SessionPanelData {
  sessionId: string
  selectedRepo: GitHubRepo | null
  selectedModel: ModelInfo | null
  mode: 'build' | 'plan'
  lastStepCost: { cost: number; tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } } } | null
  totalCost: number
  sessionTodos: TodoItem[]
  fileDiffs: Array<{ filename: string; additions: number; deletions: number }>
  openCodeUrl: string
  sessionInfo: SessionInfo | null
  messages: UIMessage[]
}

interface RightSidebarProps {
  /** Panel data to render */
  data: SessionPanelData
  /** Desktop sidebar open state */
  desktopOpen: boolean
  /** Mobile sidebar open state */
  mobileOpen: boolean
  /** Whether this is a mobile viewport */
  isMobile: boolean
  /** Callback to set mobile open state */
  onMobileOpenChange: (open: boolean) => void
  /** Callback when a todo is clicked */
  onTodoClick: (todo: TodoItem) => void
}

/**
 * Builds the common SessionPanel props from the data object to avoid repetition.
 */
function useSessionPanelProps(data: SessionPanelData, onTodoClick: (todo: TodoItem) => void) {
  return {
    sessionId: data.sessionId,
    repo: data.selectedRepo
      ? { owner: data.selectedRepo.owner, name: data.selectedRepo.name }
      : undefined,
    model: data.selectedModel
      ? {
          id: data.selectedModel.id,
          name: data.selectedModel.name,
          provider: data.selectedModel.provider,
          mode: data.mode,
        }
      : undefined,
    tokens: data.lastStepCost?.tokens
      ? { ...data.lastStepCost.tokens, contextLimit: 200000 }
      : undefined,
    cost: data.totalCost > 0 ? data.totalCost : undefined,
    todos: data.sessionTodos,
    diffs: data.fileDiffs,
    openCodeUrl: data.openCodeUrl || undefined,
    sessionInfo: data.sessionInfo || undefined,
    messages: data.messages,
    onTodoClick,
  }
}

export function RightSidebar({
  data,
  desktopOpen,
  mobileOpen,
  isMobile,
  onMobileOpenChange,
  onTodoClick,
}: RightSidebarProps) {
  const panelProps = useSessionPanelProps(data, onTodoClick)

  return (
    <>
      {/* Desktop: inline panel */}
      {desktopOpen && !isMobile && (
        <div className="w-64 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden md:block overflow-y-auto no-scrollbar">
          <SessionPanel {...panelProps} />
        </div>
      )}

      {/* Mobile: sheet drawer */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-0 overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Session Context</SheetTitle>
              <SheetDescription>Session details and context panel.</SheetDescription>
            </SheetHeader>
            <SessionPanel {...panelProps} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
