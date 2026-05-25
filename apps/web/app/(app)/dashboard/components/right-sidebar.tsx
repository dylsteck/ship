'use client'

import {
  cn,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { GitTab } from '@/components/chat/session-panel/git-tab'
import { DesktopTab } from '@/components/chat/session-panel/desktop-tab'
import { TerminalTab } from '@/components/chat/session-panel/terminal-tab'
import { useSandboxStatus } from '@/lib/api/hooks/use-sessions'
import { EllipsisIcon, MaximizeIcon, PanelToggleIcon } from './right-sidebar-icons'
import { ResizeHandle, useResizableSidebarWidth } from './right-sidebar-resize'
import type { SessionPanelData, RightSidebarTab } from '../types'

const TABS: { id: RightSidebarTab; label: string }[] = [
  { id: 'git', label: 'Git' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'desktop', label: 'Desktop' },
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
  expanded,
  sessionTitle,
}: {
  activeTab: RightSidebarTab
  onTabChange: (tab: RightSidebarTab) => void
  onToggleExpanded: () => void
  onTogglePanel: () => void
  onDeleteSession: () => void
  expanded: boolean
  sessionTitle?: string
}) {
  return (
    <div className="relative flex h-10 shrink-0 items-center px-1">
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
      {expanded && sessionTitle && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden max-w-[38vw] -translate-x-1/2 -translate-y-1/2 truncate text-xs font-medium text-zinc-300 md:block">
          {sessionTitle}
        </div>
      )}

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
    case 'desktop':
      return <DesktopTab sessionId={data.sessionId} sandboxStatus={desktopSandboxStatus} />
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
        expanded={expanded}
        sessionTitle={data.sessionInfo?.title}
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
            'hidden md:flex md:flex-col',
            expanded
              ? 'fixed inset-0 z-[100] w-auto bg-[#0d0d0d]'
              : 'relative z-20 bg-transparent',
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
        <Drawer open={mobileOpen} onOpenChange={onMobileOpenChange} direction="right">
          <DrawerContent className="w-[85vw] max-w-md p-0 overflow-hidden outline-none">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Session panel</DrawerTitle>
              <DrawerDescription>Git, terminal, and desktop tools for this session.</DrawerDescription>
            </DrawerHeader>
            {content}
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
