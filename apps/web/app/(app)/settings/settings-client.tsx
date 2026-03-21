'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { setApiToken } from '@/lib/api/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useIsMobile, SidebarTrigger, useSidebar } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { UserDropdown } from '@/components/user-dropdown'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import { Card, CardContent } from '@ship/ui'
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
    </div>
  )
}

export function SettingsClient({ userId, user, sessions: initialSessions, apiToken }: SettingsClientProps) {
  // Set API auth token synchronously so SWR fetches have it before they run
  if (apiToken) setApiToken(apiToken)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')

  // Use SWR for sessions so deletes are reflected immediately
  const { sessions: swrSessions } = useSessions(userId, { revalidateOnFocus: true })
  const sessions = swrSessions.length > 0 ? swrSessions : initialSessions

  // Agent hooks
  const { agents, isLoading: agentsLoading } = useAgents()
  const { defaultAgentId, isLoading: defaultAgentLoading } = useDefaultAgent(userId)

  // Model hooks
  const { models: availableModels, isLoading: modelsLoading } = useModels()
  const { defaultModelId, isLoading: defaultModelLoading } = useDefaultModel(userId)

  // Repo hooks
  const {
    repos,
    isLoading: reposLoading,
    loadMore: reposLoadMore,
    hasMore: reposHasMore,
    isLoadingMore: reposLoadingMore,
  } = useFilteredGitHubRepos(userId, '')
  const { defaultRepoFullName, isLoading: defaultRepoLoading } = useDefaultRepo(userId)

  // Track selected agent to filter models
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
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5 -mx-4 -mt-6 mb-4">
          <div className="flex items-center gap-2 ml-auto">
            <nav className="flex items-center gap-0.5">
              <Link
                href="/"
                className="px-1.5 py-1 text-sm transition-colors text-muted-foreground hover:text-foreground"
              >
                Agents
              </Link>
              <Link
                href="/settings"
                className="px-1.5 py-1 text-sm transition-colors text-foreground font-medium"
              >
                Settings
              </Link>
            </nav>
            <UserDropdown user={user} />
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2">
          {!isMobile && <SettingsSidebarTrigger />}
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Manage your preferences</p>
      </div>

      <div className="space-y-3 mb-8">
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

      {/* Integrations */}
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Integrations</h2>
      <div className="space-y-3 mb-8">
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <ConnectorSettings userId={userId} />
          </CardContent>
        </Card>
      </div>

      {/* Data */}
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Data</h2>
      <div className="space-y-3">
        <DeleteAllSessionsCard userId={userId} />
      </div>
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
      <div className="min-h-screen">
        {settingsContent}
      </div>
    </DashboardLayout>
  )
}
