'use client'

import { useSidebar } from '@ship/ui'
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
  const { toggleSidebar } = useSidebar()

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 relative z-10">
      {/* Left sidebar trigger — panel icon flipped horizontally */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
        title="Toggle sidebar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>

      {/* Session title or fallback */}
      {activeSessionId && (
        <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0 flex-1">
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
