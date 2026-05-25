'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn, SidebarTrigger, useSidebar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon } from '@hugeicons/core-free-icons'
import type { WebSocketStatus } from '@/lib/websocket'
import { UserDropdown } from '@/components/user-dropdown'
import {
  SandboxStatusBadge,
  ConnectionStatusBadge,
  SessionHeaderActions,
} from './dashboard-header-actions'

interface DashboardHeaderProps {
  activeSessionId: string | null
  sessionTitle?: string
  repoLabel?: string
  wsStatus: WebSocketStatus
  sandboxStatus?: string
  rightSidebarOpen?: boolean
  onToggleRightSidebar?: () => void
  onDeleteSession?: (sessionId: string) => Promise<void>
  user?: {
    username: string
    avatarUrl: string | null
  }
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
            'px-1.5 py-1 text-xs transition-colors',
            isAgents ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Agents
        </Link>
        <Link
          href="/settings"
          className={cn(
            'px-1.5 py-1 text-xs transition-colors',
            isSettings ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
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
  wsStatus,
  sandboxStatus,
  rightSidebarOpen,
  onToggleRightSidebar,
  onDeleteSession,
  user,
}: DashboardHeaderProps) {
  const { state } = useSidebar()
  const showSidebarTrigger = state === 'collapsed'

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pt-3 pb-1.5 relative z-10">
      <div className={cn('flex items-center gap-2 shrink-0', !showSidebarTrigger && 'md:hidden')}>
        <SidebarTrigger className="size-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
        <Link
          href="/"
          className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          title="New Agent"
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" />
        </Link>
      </div>
      {activeSessionId && (
        <div className="min-w-0 flex-1 flex items-center gap-1">
          <div className="font-medium truncate text-xs text-muted-foreground">{sessionTitle || 'Untitled session'}</div>
          {onDeleteSession && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="shrink-0 p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-transparent transition-colors"
                    aria-label="More options"
                  >
                    <svg className="size-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="19" cy="12" r="1.5" />
                      <circle cx="5" cy="12" r="1.5" />
                    </svg>
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem
                  onClick={() => void onDeleteSession(activeSessionId!)}
                  className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  Delete session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {activeSessionId && sandboxStatus && <SandboxStatusBadge sandboxStatus={sandboxStatus} />}
        {activeSessionId && <ConnectionStatusBadge wsStatus={wsStatus} />}
        {activeSessionId && (
          <SessionHeaderActions
            activeSessionId={activeSessionId}
            rightSidebarOpen={rightSidebarOpen}
            onToggleRightSidebar={onToggleRightSidebar}
            onDeleteSession={onDeleteSession}
          />
        )}
        <MobileNav activeSessionId={activeSessionId} user={user} />
      </div>
    </header>
  )
}
