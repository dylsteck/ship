import type { AgentStatus } from '@/components/session/status-indicator'

interface SessionPageHeaderProps {
  agentStatus: AgentStatus
  sessionTitle?: string
  branch?: string
  rightSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function SessionPageHeader({
  agentStatus,
  sessionTitle,
  branch,
  rightSidebarOpen,
  onToggleSidebar,
}: SessionPageHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border/40 bg-white dark:bg-background/95 px-3 h-[38px] relative z-10">
      <div className="flex items-center gap-2 min-w-0">
        {agentStatus !== 'idle' ? (
          <div className="relative flex items-center justify-center size-3.5 shrink-0">
            <div
              className={`size-1.5 rounded-full ${agentStatus === 'error' ? 'bg-red-500' : 'bg-green-500'} ${agentStatus !== 'error' ? 'animate-pulse' : ''}`}
            />
          </div>
        ) : (
          <svg className="size-3.5 shrink-0 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span className="text-xs text-muted-foreground truncate">{sessionTitle || 'Session'}</span>
        {branch && <span className="text-xs text-muted-foreground/40 shrink-0">{branch}</span>}
      </div>
      <button
        onClick={onToggleSidebar}
        className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
        title={rightSidebarOpen ? 'Hide panel' : 'Show panel'}
      >
        <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M15 3v18" />
        </svg>
      </button>
    </header>
  )
}
