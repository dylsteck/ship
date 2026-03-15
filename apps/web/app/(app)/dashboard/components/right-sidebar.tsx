'use client'

import { useMemo } from 'react'
import {
  cn,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@ship/ui'
import { OverviewTab } from '@/components/chat/session-panel/overview-tab'
import { GitTab } from '@/components/chat/session-panel/git-tab'
import { DesktopTab } from '@/components/chat/session-panel/desktop-tab'
import { TerminalTab } from '@/components/chat/session-panel/terminal-tab'
import { useSandboxStatus } from '@/lib/api/hooks/use-sessions'
import type { SessionPanelData, RightSidebarTab } from '../types'

const TABS: { id: RightSidebarTab; label: string }[] = [
  { id: 'git', label: 'Git' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'overview', label: 'Overview' },
]

function EllipsisIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

function MaximizeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </svg>
  )
}

function PanelToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
    </svg>
  )
}

interface RightSidebarProps {
  data: SessionPanelData
  desktopOpen: boolean
  mobileOpen: boolean
  isMobile: boolean
  expanded: boolean
  activeTab: RightSidebarTab
  onTabChange: (tab: RightSidebarTab) => void
  onToggleExpanded: () => void
  onMobileOpenChange: (open: boolean) => void
  onTogglePanel: () => void
}

function useSessionPanelProps(data: SessionPanelData) {
  return useMemo(
    () => ({
      sessionId: data.sessionId,
      repo: data.selectedRepo
        ? { owner: data.selectedRepo.owner, name: data.selectedRepo.name }
        : undefined,
      agent: data.selectedAgent
        ? { id: data.selectedAgent.id, name: data.selectedAgent.name }
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
      agentSessionId: data.agentSessionId || undefined,
      sessionInfo: data.sessionInfo || undefined,
      messages: data.messages,
    }),
    [data],
  )
}

function SidebarHeader({
  activeTab,
  onTabChange,
  onToggleExpanded,
  onTogglePanel,
}: {
  activeTab: RightSidebarTab
  onTabChange: (tab: RightSidebarTab) => void
  onToggleExpanded: () => void
  onTogglePanel: () => void
}) {
  return (
    <div className="flex items-center border-b border-border/40 px-1 shrink-0">
      <div className="flex items-center flex-1 min-w-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-2.5 py-2 text-xs transition-colors duration-150 relative whitespace-nowrap',
              activeTab === tab.id
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-2.5 right-2.5 h-[1.5px] bg-foreground rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
          aria-label="More options"
        >
          <EllipsisIcon className="size-3.5" />
        </button>
        <button
          onClick={onToggleExpanded}
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
          aria-label="Expand panel"
        >
          <MaximizeIcon className="size-3.5" />
        </button>
        <button
          onClick={onTogglePanel}
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
          aria-label="Toggle app panel"
        >
          <PanelToggleIcon className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function TabContent({
  activeTab,
  data,
  panelProps,
  desktopSandboxStatus,
  sandbox,
}: {
  activeTab: RightSidebarTab
  data: SessionPanelData
  panelProps: ReturnType<typeof useSessionPanelProps>
  desktopSandboxStatus: string | undefined
  sandbox: { sandboxId?: string | null; status?: string | null } | undefined
}) {
  switch (activeTab) {
    case 'git':
      return <GitTab diffs={data.fileDiffs} sessionInfo={data.sessionInfo ?? undefined} />
    case 'desktop':
      return (
        <DesktopTab
          sessionId={data.sessionId}
          sandboxStatus={desktopSandboxStatus}
        />
      )
    case 'terminal':
      return (
        <TerminalTab
          sessionId={data.sessionId}
          sandboxStatus={desktopSandboxStatus}
          sandboxId={sandbox?.sandboxId ?? undefined}
        />
      )
    case 'overview':
      return <OverviewTab {...panelProps} />
    default: {
      const _exhaustive: never = activeTab
      return null
    }
  }
}

export function RightSidebar({
  data,
  desktopOpen,
  mobileOpen,
  isMobile,
  expanded,
  activeTab,
  onTabChange,
  onToggleExpanded,
  onMobileOpenChange,
  onTogglePanel,
}: RightSidebarProps) {
  const panelProps = useSessionPanelProps(data)
  const { sandbox } = useSandboxStatus(data.sessionId)

  const desktopSandboxStatus = data.sandboxStatus ?? sandbox?.status ?? undefined

  const content = (
    <div className="flex flex-col h-full">
      <SidebarHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        onToggleExpanded={onToggleExpanded}
        onTogglePanel={onTogglePanel}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <TabContent
          activeTab={activeTab}
          data={data}
          panelProps={panelProps}
          desktopSandboxStatus={desktopSandboxStatus}
          sandbox={sandbox}
        />
      </div>
    </div>
  )

  return (
    <>
      {desktopOpen && !isMobile && (
        <div
          className={cn(
            'border-l border-border/40 bg-sidebar/50 backdrop-blur-sm hidden md:flex flex-col transition-[width] duration-200',
            expanded ? 'w-[600px]' : 'w-[380px]',
          )}
        >
          {content}
        </div>
      )}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent side="right" className="w-[85vw] max-w-md p-0 overflow-hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Session Context</SheetTitle>
              <SheetDescription>Session details and context panel.</SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
