import type { ChatSession } from '@/lib/api'

export interface User {
  id: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}

export interface AppSidebarProps {
  sessions: ChatSession[]
  user: User
  searchQuery: string
  onSearchChange: (value: string) => void
  currentSessionId?: string
  currentSessionTitle?: string
  onSessionDeleted?: (sessionId: string) => void
  /** Called when delete fails; use to restore the session in the list */
  onSessionDeleteFailed?: (session: ChatSession) => void
  onNewChat?: () => void
  isStreaming?: boolean
  /** Session IDs currently streaming (local + from other tabs) for per-session spinner */
  streamingSessionIds?: Set<string>
  className?: string
}
