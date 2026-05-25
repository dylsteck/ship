'use client'

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
import { GitTab } from '@/components/chat/session-panel/git-tab'
import { TerminalTab } from '@/components/chat/session-panel/terminal-tab'
import { useSandboxStatus } from '@/lib/api/hooks/use-sessions'
import { EllipsisIcon, MaximizeIcon, PanelToggleIcon } from './right-sidebar-icons'
import { ResizeHandle, useResizableSidebarWidth } from './right-sidebar-resize'
import type { SessionPanelData, RightSidebarTab } from '../types'

const TABS: { id: RightSidebarTab; label: string }[] = [
  { id: 'git', label: 'Git' },
  { id: 'terminal', label: 'Terminal' },
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
    <div className="flex h-10 shrink-0 items-center px-1">
      <div className="flex items-center flex-1 min-w-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150 whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
              activeTab === tab.id
                ? 'bg-white/10 text-zinc-100'
                : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
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
          className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          aria-label="Toggle fullscreen panel"
        >
          <MaximizeIcon className="size-3.5" />
        </button>
        <button
          onClick={onTogglePanel}
          className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
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
  desktopSandboxStatus,
  sandbox,
}: {
  activeTab: RightSidebarTab
  data: SessionPanelData
  desktopSandboxStatus: string | undefined
  sandbox: { sandboxId?: string | null; status?: string | null } | undefined
}) {
  switch (activeTab) {
    case 'git':
      return <GitTab sessionId={data.sessionId} diffs={data.fileDiffs} sessionInfo={data.sessionInfo ?? undefined} />
    case 'terminal':
      return (
        <TerminalTab
          sessionId={data.sessionId}
          sandboxStatus={desktopSandboxStatus}
          sandboxId={sandbox?.sandboxId ?? undefined}
          connectionHint={data.terminalConnectionHint}
        />
      )
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
  const { sandbox, isReady } = useSandboxStatus(data.sessionId)
  const { sidebarWidth, isResizing, handleResizePointerDown, handleResizeKeyDown } =
    useResizableSidebarWidth()

  const desktopSandboxStatus =
    (data.sandboxStatus && data.sandboxStatus !== 'unknown')
      ? data.sandboxStatus
      : isReady ? 'active' : sandbox?.status ?? undefined

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-1.5 bg-transparent px-3 pb-3 pt-2 text-zinc-300">
      <SidebarHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        onToggleExpanded={onToggleExpanded}
        onTogglePanel={onTogglePanel}
        onDeleteSession={() => {
          void onDeleteSession(data.sessionId)
        }}
      />
      <div className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-white/10 bg-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <TabContent
          activeTab={activeTab}
          data={data}
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
          style={expanded ? undefined : { width: sidebarWidth }}
          className={cn(
            'hidden bg-transparent md:flex md:flex-col',
            expanded
              ? 'absolute inset-0 z-40 w-auto'
              : 'relative z-20',
            !isResizing && 'transition-[width] duration-200',
          )}
        >
          {!expanded && (
            <ResizeHandle
              width={sidebarWidth}
              onPointerDown={handleResizePointerDown}
              onKeyDown={handleResizeKeyDown}
            />
          )}
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
