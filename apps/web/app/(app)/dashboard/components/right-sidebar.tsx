'use client'

import { useMemo } from 'react'
import {
  cn,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { OverviewTab } from '@/components/chat/session-panel/overview-tab'
import { GitTab } from '@/components/chat/session-panel/git-tab'
import { TerminalTab } from '@/components/chat/session-panel/terminal-tab'
import { useSandboxStatus } from '@/lib/api/hooks/use-sessions'
import { EllipsisIcon, MaximizeIcon, PanelToggleIcon } from './right-sidebar-icons'
import type { SessionPanelData, RightSidebarTab } from '../types'

const TABS: { id: RightSidebarTab; label: string }[] = [
  { id: 'git', label: 'Git' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'overview', label: 'Overview' },
]

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
  onDeleteSession: (sessionId: string) => Promise<void>
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
  onDeleteSession,
}: {
  activeTab: RightSidebarTab
  onTabChange: (tab: RightSidebarTab) => void
  onToggleExpanded: () => void
  onTogglePanel: () => void
  onDeleteSession: () => void
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
                aria-label="More options"
              >
                <EllipsisIcon className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={onDeleteSession}
              className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              Delete session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    case 'terminal':
      return (
        <TerminalTab
          sessionId={data.sessionId}
          sandboxStatus={desktopSandboxStatus}
          sandboxId={sandbox?.sandboxId ?? undefined}
          connectionHint={data.terminalConnectionHint}
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
  onDeleteSession,
}: RightSidebarProps) {
  const panelProps = useSessionPanelProps(data)
  const { sandbox, isReady } = useSandboxStatus(data.sessionId)

  const desktopSandboxStatus =
    (data.sandboxStatus && data.sandboxStatus !== 'unknown')
      ? data.sandboxStatus
      : isReady ? 'active' : sandbox?.status ?? undefined

  const content = (
    <div className="flex flex-col h-full">
      <SidebarHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        onToggleExpanded={onToggleExpanded}
        onTogglePanel={onTogglePanel}
        onDeleteSession={() => {
          void onDeleteSession(data.sessionId)
        }}
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
            expanded ? 'w-[520px]' : 'w-[340px]',
          )}
        >
          {content}
        </div>
      )}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent side="right" className="w-[85vw] max-w-md p-0 overflow-hidden" showCloseButton={false}>
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
