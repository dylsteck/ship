'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDeleteSession } from '@/lib/api'
import type { ChatSession } from '@/lib/api/server'
import { Sidebar } from '@ship/ui'
import { SidebarHeaderSection } from './sidebar-header'
import { SidebarSessionsList } from './sidebar-sessions-list'
import { SidebarFooterSection } from './sidebar-footer'
import type { AppSidebarProps } from './types'

export type { AppSidebarProps } from './types'
export type { User } from './types'

export function AppSidebar({
  sessions,
  user,
  searchQuery,
  currentSessionId,
  currentSessionTitle,
  onSessionDeleted,
  onSessionDeleteFailed,
  onNewChat,
  isStreaming = false,
  streamingSessionIds,
  className,
}: AppSidebarProps) {
  const router = useRouter()
  const { deleteSession } = useDeleteSession()
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'none' | 'project' | 'date' | 'status'>('none')
  const [compact, setCompact] = useState(true)

  // Filter by search query
  const filtered = sessions.filter(
    (s) =>
      searchQuery === '' ||
      s.repoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.repoOwner.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleDeleteSession = async (session: ChatSession) => {
    setDeletingSessionId(session.id)
    onSessionDeleted?.(session.id)
    try {
      await deleteSession({ sessionId: session.id })
      if (currentSessionId === session.id) {
        router.push('/')
        window.location.href = '/'
      }
    } catch (error) {
      console.warn('Failed to delete session:', error)
      onSessionDeleteFailed?.(session)
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" className={className}>
      <SidebarHeaderSection onNewChat={onNewChat} />

      <SidebarSessionsList
        sessions={filtered}
        currentSessionId={currentSessionId}
        currentSessionTitle={currentSessionTitle}
        isStreaming={isStreaming}
        streamingSessionIds={streamingSessionIds}
        deletingSessionId={deletingSessionId}
        onDeleteSession={handleDeleteSession}
        groupBy={groupBy}
        compact={compact}
      />

      <SidebarFooterSection
        user={user}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        compact={compact}
        onCompactChange={setCompact}
      />

    </Sidebar>
  )
}
