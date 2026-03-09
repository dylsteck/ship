'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { UserDropdown } from '@/components/user-dropdown'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ship/ui'
import {
  useModels,
  useDefaultModel,
  useAgents,
  useDefaultAgent,
  useFilteredGitHubRepos,
  useDefaultRepo,
} from '@/lib/api'
import { DefaultAgentCard } from './default-agent-card'
import { DefaultModelCard } from './default-model-card'
import { DefaultRepoCard } from './default-repo-card'

export function SettingsClient({ userId, user }: { userId: string; user?: { username: string; avatarUrl: string | null } }) {
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

  if (loading) {
    return (
      <SettingsShell user={user}>
        <div className="flex items-center justify-center py-24">
          <div className="size-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
        </div>
      </SettingsShell>
    )
  }

  return (
    <SettingsShell user={user}>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-lg font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-[12px] text-muted-foreground mb-5">Manage your preferences</p>

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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">Integrations</CardTitle>
            <CardDescription className="text-[11px]">Connect external services</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectorSettings userId={userId} />
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  )
}

function SettingsShell({ children, user }: { children: React.ReactNode; user?: { username: string; avatarUrl: string | null } }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="h-11 border-b border-border bg-background">
        <div className="h-full flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">Ship</span>
          </Link>

          {/* Desktop: simple logout link */}
          <a
            href="/api/auth/logout"
            className="hidden md:block text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Logout
          </a>

          {/* Mobile: Agents / Settings tabs + avatar dropdown */}
          <div className="flex items-center gap-2 md:hidden">
            <nav className="flex items-center gap-0.5">
              <Link href="/" className="px-1.5 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Agents
              </Link>
              <Link href="/settings" className="px-1.5 py-1 text-sm text-foreground font-medium transition-colors">
                Settings
              </Link>
            </nav>
            <UserDropdown user={user} />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
