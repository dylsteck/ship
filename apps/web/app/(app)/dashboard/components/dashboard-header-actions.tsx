'use client'

import { cn } from '@ship/ui'
import type { WebSocketStatus } from '@/lib/websocket'


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

export function ConnectionStatusBadge({ wsStatus: _wsStatus }: { wsStatus: WebSocketStatus }) {
  return null
}

export function SessionHeaderActions({
  rightSidebarOpen,
  onToggleRightSidebar,
}: {
  activeSessionId: string
  rightSidebarOpen?: boolean
  onToggleRightSidebar?: () => void
  onDeleteSession?: (sessionId: string) => Promise<void>
}) {
  if (!onToggleRightSidebar || rightSidebarOpen) return null

  return (
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
  )
}
