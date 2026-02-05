'use client'

import { SidebarTrigger } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon } from '@hugeicons/core-free-icons'
import type { GitHubRepo } from '@/lib/api'
import type { WebSocketStatus } from '@/lib/websocket'

interface DashboardHeaderProps {
  activeSessionId: string | null
  selectedRepo: GitHubRepo | null
  wsStatus: WebSocketStatus
}

export function DashboardHeader({ activeSessionId, selectedRepo, wsStatus }: DashboardHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 relative z-10">
      <SidebarTrigger className="cursor-pointer" />

      {activeSessionId && selectedRepo && (
        <div className="flex items-center gap-2 text-sm">
          <HugeiconsIcon icon={GithubIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
          <span className="font-medium">{selectedRepo.fullName}</span>
        </div>
      )}

      {activeSessionId && wsStatus !== 'connected' && (
        <div className="ml-auto text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          {wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
        </div>
      )}
    </header>
  )
}
