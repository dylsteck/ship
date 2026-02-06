'use client'

import { useRouter } from 'next/navigation'
import { SidebarTrigger } from '@ship/ui'
import type { WebSocketStatus } from '@/lib/websocket'

interface DashboardHeaderProps {
  activeSessionId: string | null
  sessionTitle?: string
  wsStatus: WebSocketStatus
  rightSidebarOpen?: boolean
  onToggleRightSidebar?: () => void
}

export function DashboardHeader({
  activeSessionId,
  sessionTitle,
  wsStatus,
  rightSidebarOpen,
  onToggleRightSidebar,
}: DashboardHeaderProps) {
  const router = useRouter()

  return (
    <header className="flex items-center gap-3 px-4 py-3 relative z-10">
      <SidebarTrigger className="cursor-pointer" />

      {/* Session title or fallback */}
      {activeSessionId && (
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <span className="font-medium truncate">
            {sessionTitle || 'Untitled session'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {/* WS status indicator */}
        {activeSessionId && wsStatus !== 'connected' && (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </div>
        )}

        {/* New chat button */}
        {activeSessionId && (
          <button
            onClick={() => {
              router.push('/')
            }}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
          </button>
        )}

        {/* Right sidebar toggle */}
        {activeSessionId && onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
            title={rightSidebarOpen ? 'Hide context panel' : 'Show context panel'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
