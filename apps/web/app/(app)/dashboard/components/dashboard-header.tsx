'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  cn,
  SidebarTrigger,
  useSidebar,
  useIsMobile,
} from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Search01Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import type { WebSocketStatus } from '@/lib/websocket'
import { UserDropdown } from '@/components/user-dropdown'

interface DashboardHeaderProps {
  activeSessionId: string | null
  sessionTitle?: string
  repoLabel?: string
  wsStatus: WebSocketStatus
  sandboxStatus?: string
  rightSidebarOpen?: boolean
  onToggleRightSidebar?: () => void
  user?: {
    username: string
    avatarUrl: string | null
  }
}

const sandboxStatusConfig: Record<string, { label: string; color: string; pulse?: boolean }> = {
  active: { label: 'Active', color: 'text-green-600 dark:text-green-400' },
  provisioning: { label: 'Provisioning...', color: 'text-amber-600 dark:text-amber-400', pulse: true },
  resuming: { label: 'Resuming...', color: 'text-amber-600 dark:text-amber-400', pulse: true },
  paused: { label: 'Paused', color: 'text-muted-foreground/60' },
  error: { label: 'Error', color: 'text-red-600 dark:text-red-400' },
}

function MobileNav({
  activeSessionId,
  user,
}: {
  activeSessionId: string | null
  user?: { username: string; avatarUrl: string | null }
}) {
  const pathname = usePathname()
  if (activeSessionId) return null

  const isSettings = pathname === '/settings'
  const isAgents = !isSettings

  return (
    <div className="flex items-center gap-2 ml-auto md:hidden">
      <nav className="flex items-center gap-0.5">
        <Link
          href="/"
          className={cn(
            'px-1.5 py-1 text-sm transition-colors',
            isAgents
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Agents
        </Link>
        <Link
          href="/settings"
          className={cn(
            'px-1.5 py-1 text-sm transition-colors',
            isSettings
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Settings
        </Link>
      </nav>
      <UserDropdown user={user} />
    </div>
  )
}

export function DashboardHeader({
  activeSessionId,
  sessionTitle,
  repoLabel,
  wsStatus,
  sandboxStatus,
  rightSidebarOpen,
  onToggleRightSidebar,
  user,
}: DashboardHeaderProps) {
  const sbConfig = sandboxStatus ? sandboxStatusConfig[sandboxStatus] : null
  const { state } = useSidebar()
  const isMobile = useIsMobile()
  const showSidebarTrigger = state === 'collapsed' && !isMobile

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pt-3 pb-1.5 relative z-10">
      {showSidebarTrigger && (
        <div className="flex items-center gap-2 shrink-0">
          <SidebarTrigger className="size-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
          <button
            type="button"
            onClick={() => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }}
            className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            title="Search (⌘K)"
          >
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5" />
          </button>
          <Link
            href="/"
            className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            title="New Agent"
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" />
          </Link>
        </div>
      )}
      {activeSessionId && isMobile && (
        <Link
          href="/"
          className="shrink-0 p-1.5 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Back to home"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
        </Link>
      )}
      {activeSessionId && (
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-xs text-muted-foreground">
            {sessionTitle || 'Untitled session'}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {activeSessionId && sbConfig && sandboxStatus !== 'unknown' && (
          <div className={cn('text-[10px] flex items-center gap-1.5 mr-2', sbConfig.color)}>
            <span
              className={cn(
                'size-1.5 rounded-full',
                sandboxStatus === 'active' && 'bg-green-500',
                sandboxStatus === 'paused' && 'bg-muted-foreground/40',
                sandboxStatus === 'error' && 'bg-red-500',
                (sandboxStatus === 'provisioning' || sandboxStatus === 'resuming') && 'bg-amber-500 animate-pulse',
              )}
            />
            {sbConfig.label}
          </div>
        )}

        {activeSessionId && wsStatus !== 'connected' && (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mr-2">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            {wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </div>
        )}

        {activeSessionId && onToggleRightSidebar && !rightSidebarOpen && (
          <button
            onClick={onToggleRightSidebar}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
            title={rightSidebarOpen ? 'Hide context panel' : 'Show context panel'}
          >
            <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        )}

        <MobileNav activeSessionId={activeSessionId} user={user} />
      </div>
    </header>
  )
}
