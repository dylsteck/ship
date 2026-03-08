'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@ship/ui'
import { SessionPanel } from '@/components/chat/session-panel'
import type { SessionPanelData } from '../types'

interface RightSidebarProps {
  data: SessionPanelData
  desktopOpen: boolean
  mobileOpen: boolean
  isMobile: boolean
  onMobileOpenChange: (open: boolean) => void
}

function useSessionPanelProps(data: SessionPanelData) {
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
    agentUrl: data.agentUrl || undefined,
    sessionInfo: data.sessionInfo || undefined,
    messages: data.messages,
  }
}

export function RightSidebar({
  data,
  desktopOpen,
  mobileOpen,
  isMobile,
  onMobileOpenChange,
}: RightSidebarProps) {
  const panelProps = useSessionPanelProps(data)

  return (
    <>
      {/* Desktop: inline panel */}
      {desktopOpen && !isMobile && (
        <div className="w-60 border-l border-border/40 bg-sidebar/50 backdrop-blur-sm hidden md:block overflow-y-auto no-scrollbar">
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
