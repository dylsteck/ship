'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useDeleteSession, type ChatSession } from '@/lib/api'
import { Sidebar } from '@ship/ui'
import { ChatSearchCommand } from '../chat-search-command'
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
  onSearchChange,
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
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

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
      console.error('Failed to delete session:', error)
      onSessionDeleteFailed?.(session)
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" className={className}>
      <SidebarHeaderSection
        onSearchOpen={() => setSearchOpen(true)}
        onNewChat={onNewChat}
      />

      <SidebarSessionsList
        sessions={filtered}
        currentSessionId={currentSessionId}
        currentSessionTitle={currentSessionTitle}
        isStreaming={isStreaming}
        streamingSessionIds={streamingSessionIds}
        deletingSessionId={deletingSessionId}
        onDeleteSession={handleDeleteSession}
      />

      <SidebarFooterSection user={user} />

      <ChatSearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        currentSessionTitle={currentSessionTitle}
      />
    </Sidebar>
  )
}
