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
  onNewChat?: () => void
  isStreaming?: boolean
  className?: string
}
