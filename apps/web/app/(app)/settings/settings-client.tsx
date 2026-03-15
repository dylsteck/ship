'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { setApiToken } from '@/lib/api/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useIsMobile, SidebarTrigger } from '@ship/ui'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import { Card, CardContent } from '@ship/ui'
import {
  useModels,
  useDefaultModel,
  useAgents,
  useDefaultAgent,
  useFilteredGitHubRepos,
  useDefaultRepo,
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

export function SettingsClient({ userId, user, sessions, apiToken }: SettingsClientProps) {
  // Set API auth token synchronously so SWR fetches have it before they run
  if (apiToken) setApiToken(apiToken)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')

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
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center size-8 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
      )}

      {/* Desktop header */}
      {!isMobile && (
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-6">Manage your preferences</p>

      {/* Defaults */}
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Defaults</h2>
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
      <div className="min-h-screen bg-muted/30">
        {settingsContent}
      </div>
    </DashboardLayout>
  )
}
