'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  cn,
  SidebarTrigger,
  useSidebar,
  useIsMobile,
} from '@ship/ui'
import type { WebSocketStatus } from '@/lib/websocket'

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
      <Link href="/settings" className="shrink-0">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            width={28}
            height={28}
            className="size-7 rounded-full object-cover hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium hover:opacity-80 transition-opacity">
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </Link>
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
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 relative z-10">
      {/* Sidebar trigger when collapsed (desktop only) */}
      {showSidebarTrigger && (
        <SidebarTrigger className="size-5 cursor-pointer text-muted-foreground hover:text-foreground shrink-0" />
      )}
      {/* Active session title */}
      {activeSessionId && (
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-xs sm:text-sm">
            {sessionTitle || 'Untitled session'}
          </div>
          {repoLabel && (
            <div className="truncate text-[11px] text-muted-foreground mt-0.5">
              {repoLabel}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {/* Sandbox status pill */}
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

        {/* WS status indicator */}
        {activeSessionId && wsStatus !== 'connected' && (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mr-2">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            {wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </div>
        )}

        {/* Right sidebar toggle */}
        {activeSessionId && onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
            title={rightSidebarOpen ? 'Hide context panel' : 'Show context panel'}
          >
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        )}

        {/* Mobile nav + avatar - homepage/settings only */}
        <MobileNav activeSessionId={activeSessionId} user={user} />
      </div>
    </header>
  )
}
