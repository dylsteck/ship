'use client'

import { useState } from 'react'
import type { ChatSession } from '@/lib/api/server'
import {
  groupSessionsByRepo,
  SidebarFlatSessionList,
  SidebarRepoGroupList,
  SidebarArchivedSection,
} from './sidebar-sessions-list-sections'

interface SidebarSessionsListProps {
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
  isStreaming: boolean
  streamingSessionIds?: Set<string>
  deletingSessionId: string | null
  onDeleteSession: (session: ChatSession) => void
  groupBy: 'none' | 'project' | 'date' | 'status'
  compact: boolean
}

export function SidebarSessionsList({
  sessions,
  currentSessionId,
  currentSessionTitle,
  isStreaming,
  streamingSessionIds,
  deletingSessionId,
  onDeleteSession,
  groupBy,
}: SidebarSessionsListProps) {
  const [collapsedRepos, setCollapsedRepos] = useState<Set<string>>(new Set())
  const { nonArchived, archived, repoEntries } = groupSessionsByRepo(sessions)
  const groupByRepo = groupBy === 'project'

  const toggleRepo = (key: string) => {
    setCollapsedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const listProps = {
    currentSessionId,
    currentSessionTitle,
    isStreaming,
    streamingSessionIds,
    deletingSessionId,
    onDeleteSession,
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-2 pt-6 group-data-[collapsible=icon]:hidden">
        {groupByRepo ? (
          <SidebarRepoGroupList
            repoEntries={repoEntries}
            collapsedRepos={collapsedRepos}
            onToggleRepo={toggleRepo}
            {...listProps}
          />
        ) : (
          <SidebarFlatSessionList sessions={nonArchived} {...listProps} />
        )}
      </div>
      <SidebarArchivedSection archived={archived} />
    </div>
  )
}
