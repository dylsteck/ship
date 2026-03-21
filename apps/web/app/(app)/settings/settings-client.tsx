'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { setApiToken } from '@/lib/api/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useIsMobile, SidebarTrigger, useSidebar } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { UserDropdown } from '@/components/user-dropdown'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import {
  useModels,
  useDefaultModel,
  useAgents,
  useDefaultAgent,
  useFilteredGitHubRepos,
  useDefaultRepo,
  useSessions,
} from '@/lib/api'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import { DashboardLayout } from '../dashboard/components/dashboard-layout'
import { DefaultAgentCard } from './default-agent-card'
import { DefaultModelCard } from './default-model-card'
import { DefaultRepoCard } from './default-repo-card'
import { DeleteAllSessionsCard } from './delete-all-sessions-card'

interface SettingsClientProps {
  userId: string
  user: User
  sessions: ChatSession[]
  apiToken?: string
}

function SettingsSidebarTrigger() {
  const { state } = useSidebar()
  if (state !== 'collapsed') return null
  return (
    <div className="flex items-center gap-2 shrink-0">
      <SidebarTrigger className="size-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
      <button
        type="button"
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
        }}
        className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        title="Search (⌘K)"
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5" />
      </button>
      <Link
        href="/"
        className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        title="New Agent"
      >
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" />
      </Link>
    </div>
  )
}

export function SettingsClient({ userId, user, sessions: initialSessions, apiToken }: SettingsClientProps) {
  if (apiToken) setApiToken(apiToken)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')

  const { sessions: swrSessions } = useSessions(userId, { revalidateOnFocus: true })
  const sessions = swrSessions.length > 0 ? swrSessions : initialSessions

  const { agents, isLoading: agentsLoading } = useAgents()
  const { defaultAgentId, isLoading: defaultAgentLoading } = useDefaultAgent(userId)
  const { models: availableModels, isLoading: modelsLoading } = useModels()
  const { defaultModelId, isLoading: defaultModelLoading } = useDefaultModel(userId)
  const {
    repos,
    isLoading: reposLoading,
    loadMore: reposLoadMore,
    hasMore: reposHasMore,
    isLoadingMore: reposLoadingMore,
  } = useFilteredGitHubRepos(userId, '')
  const { defaultRepoFullName, isLoading: defaultRepoLoading } = useDefaultRepo(userId)

  const [selectedAgentId, setSelectedAgentId] = useState<string>('')

  useEffect(() => {
    if (defaultAgentId && !selectedAgentId) {
      setSelectedAgentId(defaultAgentId)
    }
  }, [defaultAgentId, selectedAgentId])

  const agentModels = useMemo(() => {
    const agent = agents.find((a) => a.id === selectedAgentId)
    return agent?.models || availableModels
  }, [agents, selectedAgentId, availableModels])

  const loading = agentsLoading || defaultAgentLoading || modelsLoading || defaultModelLoading || reposLoading || defaultRepoLoading

  const handleNewChat = useCallback(() => {
    router.push('/')
  }, [router])

  const handleSessionDeleted = useCallback((_id: string) => {
    router.refresh()
  }, [router])

  const settingsContent = loading ? (
    <div className="flex items-center justify-center py-24">
      <div className="size-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
    </div>
  ) : (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5 -mx-4 -mt-8 mb-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-base leading-none">&lsaquo;</span>
            Back to Agents
          </Link>
          <UserDropdown user={user} />
        </div>
      )}

      <h1 className="text-xl font-semibold text-foreground mb-8">Settings</h1>

      {/* Preferences */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Preferences</h2>
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          <DefaultAgentCard
            userId={userId}
            agents={agents}
            defaultAgentId={defaultAgentId}
            onAgentChange={setSelectedAgentId}
          />
          {agentModels.length > 1 && (
            <DefaultModelCard
              userId={userId}
              models={agentModels}
              defaultModelId={defaultModelId}
            />
          )}
          <DefaultRepoCard
            userId={userId}
            repos={repos}
            reposLoading={reposLoading}
            reposLoadMore={reposLoadMore}
            reposHasMore={reposHasMore ?? false}
            reposLoadingMore={reposLoadingMore ?? false}
            defaultRepoFullName={defaultRepoFullName}
          />
        </div>
      </section>

      {/* Integrations */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Integrations</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <ConnectorSettings userId={userId} />
        </div>
      </section>

      {/* Data */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Data</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <DeleteAllSessionsCard userId={userId} />
        </div>
      </section>
    </div>
  )

  return (
    <DashboardLayout
      defaultOpen={!isMobile}
      sidebarProps={{
        sessions,
        user,
        searchQuery,
        onSearchChange: setSearchQuery,
        onSessionDeleted: handleSessionDeleted,
        onNewChat: handleNewChat,
        isStreaming: false,
      }}
    >
      <div className="min-h-screen relative">
        {!isMobile && (
          <div className="fixed top-3 left-3 z-10">
            <SettingsSidebarTrigger />
          </div>
        )}
        {settingsContent}
      </div>
    </DashboardLayout>
  )
}
