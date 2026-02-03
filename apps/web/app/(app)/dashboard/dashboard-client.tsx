'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  useGitHubRepos,
  useModels,
  useCreateSession,
  type ChatSession,
  type GitHubRepo,
  type ModelInfo,
  type User,
} from '@/lib/api'
import { CreateSessionDialog } from '@/components/session/create-session-dialog'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatComposer } from '@/components/chat-composer'
import { DashboardStats } from '@/components/dashboard-stats'
import { DashboardBackground } from '@/components/dashboard-background'

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

export function DashboardClient({ sessions, userId, user }: DashboardClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setMode] = useState<'build' | 'agent'>('build')
  const [prompt, setPrompt] = useState('')
  const router = useRouter()

  // Fetch repos and models with SWR
  const { repos, isLoading: reposLoading } = useGitHubRepos(userId)
  const { models, groupedByProvider, isLoading: modelsLoading } = useModels()
  const { createSession, isCreating } = useCreateSession()

  // Set default model once loaded
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0])
    }
  }, [models, selectedModel])

  const handleCreate = async (data: { repoOwner: string; repoName: string; model?: string }) => {
    try {
      const newSession = await createSession({
        userId,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
        model: data.model || selectedModel?.id || 'anthropic/claude-sonnet-4',
      })
      if (newSession) {
        router.push(`/session/${newSession.id}`)
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleSubmit = () => {
    if (!selectedRepo || !prompt.trim() || isCreating) return
    handleCreate({ repoOwner: selectedRepo.owner, repoName: selectedRepo.name, model: selectedModel?.id })
  }

  // Calculate stats from sessions
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const recentSessions = sessions.filter(s => s.lastActivity > oneWeekAgo)
  const stats = {
    sessionsPastWeek: recentSessions.length,
    messagesPastWeek: recentSessions.reduce((acc, s) => acc + (s.messageCount || 0), 0),
    activeRepos: new Set(sessions.map(s => `${s.repoOwner}/${s.repoName}`)).size,
  }

  // For demo, show 1 human prompting (the current user)
  const humansPrompting = 1

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar 
        sessions={sessions} 
        user={user} 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <SidebarInset>
        <div className="flex h-screen flex-col relative">
          <DashboardBackground />
          
          {/* Header with sidebar trigger */}
          <header className="flex items-center gap-2 p-3 relative z-10">
            <SidebarTrigger className="cursor-pointer" />
          </header>

          {/* Main content */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
            <div className="w-full max-w-[540px] space-y-6">
              <ChatComposer
                prompt={prompt}
                onPromptChange={setPrompt}
                selectedRepo={selectedRepo}
                onRepoSelect={setSelectedRepo}
                repos={repos}
                reposLoading={reposLoading}
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                modelsLoading={modelsLoading}
                groupedByProvider={groupedByProvider}
                mode={mode}
                onModeChange={setMode}
                onSubmit={handleSubmit}
                isCreating={isCreating}
              />

              {/* Stats cards */}
              <DashboardStats stats={stats} />
            </div>
          </main>

          {/* Footer */}
          <footer className="py-4 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{humansPrompting} {humansPrompting === 1 ? 'human' : 'humans'} prompting</span>
            </div>
          </footer>
        </div>
      </SidebarInset>

      <CreateSessionDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onCreate={handleCreate} userId={userId} />
    </SidebarProvider>
  )
}
