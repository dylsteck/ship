'use client'

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { PanelRightIcon, Settings01Icon, Logout01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import type { WebSocketStatus } from '@/lib/websocket'
import { ClientOnly } from '@/components/client-only'

interface DashboardHeaderProps {
  activeSessionId: string | null
  sessionTitle?: string
  wsStatus: WebSocketStatus
  sandboxStatus?: string
  rightSidebarOpen?: boolean
  onToggleRightSidebar?: () => void
  showBackButton?: boolean
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

export function DashboardHeader({
  activeSessionId,
  sessionTitle,
  wsStatus,
  sandboxStatus,
  rightSidebarOpen,
  onToggleRightSidebar,
  showBackButton,
  user,
}: DashboardHeaderProps) {
  const sbConfig = sandboxStatus ? sandboxStatusConfig[sandboxStatus] : null

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 relative z-10">
      {/* Back button + Session title */}
      {activeSessionId && (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBackButton && (
            <button
              onClick={() => (window.location.href = '/')}
              className="shrink-0 p-1 -ml-1 text-muted-foreground hover:text-foreground"
              aria-label="Back to home"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
            </button>
          )}
          <span className="font-medium truncate text-xs sm:text-sm">
            {sessionTitle || 'Untitled session'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {/* Sandbox status pill */}
        {activeSessionId && sbConfig && sandboxStatus !== 'unknown' && (
          <div className={cn('text-[10px] flex items-center gap-1.5 mr-2', sbConfig.color)}>
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
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
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
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
            <HugeiconsIcon icon={PanelRightIcon} className="size-4" strokeWidth={2} />
          </button>
        )}

        {/* User avatar with dropdown - mobile only, homepage only */}
        {!activeSessionId && (
          <div className="shrink-0 ml-2 md:hidden">
            <ClientOnly
              fallback={
                <a href="/settings" className="focus:outline-none rounded-full cursor-pointer block">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full object-cover hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium hover:opacity-80 transition-opacity">
                      {user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </a>
              }
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="focus:outline-none rounded-full cursor-pointer">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-full object-cover hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium hover:opacity-80 transition-opacity">
                          {user?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => (window.location.href = '/settings')} className="cursor-pointer">
                    <HugeiconsIcon icon={Settings01Icon} className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => (window.location.href = '/api/auth/signout')}
                    className="cursor-pointer text-red-600 dark:text-red-400"
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ClientOnly>
          </div>
        )}
      </div>
    </header>
  )
}
