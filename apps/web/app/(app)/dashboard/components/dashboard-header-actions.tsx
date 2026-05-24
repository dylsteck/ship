'use client'

import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ship/ui'
import type { WebSocketStatus } from '@/lib/websocket'

function EllipsisIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

const sandboxStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-green-600 dark:text-green-400' },
  provisioning: { label: 'Provisioning...', color: 'text-amber-600 dark:text-amber-400' },
  resuming: { label: 'Resuming...', color: 'text-amber-600 dark:text-amber-400' },
  paused: { label: 'Paused', color: 'text-muted-foreground/60' },
  error: { label: 'Error', color: 'text-red-600 dark:text-red-400' },
}

export function SandboxStatusBadge({ sandboxStatus }: { sandboxStatus: string }) {
  const sbConfig = sandboxStatusConfig[sandboxStatus]
  if (!sbConfig || sandboxStatus === 'unknown') return null

  return (
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
  )
}

export function ConnectionStatusBadge({ wsStatus }: { wsStatus: WebSocketStatus }) {
  if (wsStatus === 'connected') return null

  return (
    <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mr-2">
      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
      {wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
    </div>
  )
}

export function SessionHeaderActions({
  activeSessionId,
  rightSidebarOpen,
  onToggleRightSidebar,
  onDeleteSession,
}: {
  activeSessionId: string
  rightSidebarOpen?: boolean
  onToggleRightSidebar?: () => void
  onDeleteSession?: (sessionId: string) => Promise<void>
}) {
  if (!onToggleRightSidebar || rightSidebarOpen) return null

  return (
    <div className="flex items-center gap-0.5">
      {onDeleteSession && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
                aria-label="More options"
              >
                <EllipsisIcon className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => {
                void onDeleteSession(activeSessionId)
              }}
              className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              Delete session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button
        onClick={onToggleRightSidebar}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
        title="Show context panel"
      >
        <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M15 3v18" />
        </svg>
      </button>
    </div>
  )
}
