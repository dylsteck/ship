'use client'

import { useState, useMemo, useEffect } from 'react'
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
import {
  Card,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  cn,
} from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Mic01Icon, AttachmentIcon, ArrowUp02Icon, GithubIcon, PlusSignIcon } from '@hugeicons/core-free-icons'

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

function AreaChart({ color = 'var(--chart-1)' }: { color?: string }) {
  const points = useMemo(() => {
    const data = [30, 35, 32, 40, 38, 45, 42, 50, 48, 55, 60, 65]
    return data.map((y, i) => `${(i / 11) * 100},${100 - y}`).join(' ')
  }, [])
  
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={`gradient-chart`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill="url(#gradient-chart)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 relative overflow-hidden">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </p>
      <div className="absolute bottom-0 left-0 right-0 h-12 opacity-80">
        <AreaChart />
      </div>
    </Card>
  )
}

// Halftone dot pattern background component
function HalftoneBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Top-left corner pattern */}
      <svg className="absolute -top-20 -left-20 w-[600px] h-[600px] opacity-[0.15]" viewBox="0 0 400 400">
        <defs>
          <radialGradient id="fadeTopLeft" cx="0%" cy="0%" r="100%">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="1" />
            <stop offset="60%" stopColor="rgb(59, 130, 246)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 30 }).map((_, row) =>
          Array.from({ length: 30 }).map((_, col) => {
            const distance = Math.sqrt(row * row + col * col)
            const maxDistance = Math.sqrt(30 * 30 + 30 * 30)
            const size = Math.max(1, 4 - (distance / maxDistance) * 3.5)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.2)
            return (
              <circle
                key={`tl-${row}-${col}`}
                cx={col * 14 + 7}
                cy={row * 14 + 7}
                r={size}
                fill="rgb(59, 130, 246)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>
      
      {/* Top-right corner pattern */}
      <svg className="absolute -top-20 -right-20 w-[600px] h-[600px] opacity-[0.12]" viewBox="0 0 400 400">
        {Array.from({ length: 30 }).map((_, row) =>
          Array.from({ length: 30 }).map((_, col) => {
            const distance = Math.sqrt(row * row + (29 - col) * (29 - col))
            const maxDistance = Math.sqrt(30 * 30 + 30 * 30)
            const size = Math.max(1, 4 - (distance / maxDistance) * 3.5)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.2)
            return (
              <circle
                key={`tr-${row}-${col}`}
                cx={col * 14 + 7}
                cy={row * 14 + 7}
                r={size}
                fill="rgb(59, 130, 246)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>
      
      {/* Bottom-left corner pattern */}
      <svg className="absolute -bottom-20 -left-20 w-[500px] h-[500px] opacity-[0.08]" viewBox="0 0 400 400">
        {Array.from({ length: 25 }).map((_, row) =>
          Array.from({ length: 25 }).map((_, col) => {
            const distance = Math.sqrt((24 - row) * (24 - row) + col * col)
            const maxDistance = Math.sqrt(25 * 25 + 25 * 25)
            const size = Math.max(1, 3.5 - (distance / maxDistance) * 3)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.3)
            return (
              <circle
                key={`bl-${row}-${col}`}
                cx={col * 16 + 8}
                cy={row * 16 + 8}
                r={size}
                fill="rgb(100, 116, 139)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>
      
      {/* Bottom-right corner pattern */}
      <svg className="absolute -bottom-20 -right-20 w-[500px] h-[500px] opacity-[0.06]" viewBox="0 0 400 400">
        {Array.from({ length: 25 }).map((_, row) =>
          Array.from({ length: 25 }).map((_, col) => {
            const distance = Math.sqrt((24 - row) * (24 - row) + (24 - col) * (24 - col))
            const maxDistance = Math.sqrt(25 * 25 + 25 * 25)
            const size = Math.max(1, 3.5 - (distance / maxDistance) * 3)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.3)
            return (
              <circle
                key={`br-${row}-${col}`}
                cx={col * 16 + 8}
                cy={row * 16 + 8}
                r={size}
                fill="rgb(100, 116, 139)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>
    </div>
  )
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
          <HalftoneBackground />
          
          {/* Header with sidebar trigger */}
          <header className="flex items-center gap-2 p-3 relative z-10">
            <SidebarTrigger />
          </header>

          {/* Main content */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
            <div className="w-full max-w-[540px] space-y-6">
              {/* Input Card - ChatGPT style */}
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Text input area */}
                <div className="p-4">
                  <textarea
                    placeholder="Ask or build anything"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full min-h-[80px] resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>

                {/* Bottom bar with controls */}
                <div className="px-3 pb-3 flex items-center justify-between">
                  {/* Left side: Add button and repo selector */}
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-full hover:bg-accent transition-colors">
                        <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[220px]">
                        <DropdownMenuItem>
                          <HugeiconsIcon icon={AttachmentIcon} size={16} strokeWidth={2} className="mr-2" />
                          Add files
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-sm hover:bg-accent transition-colors">
                        <HugeiconsIcon icon={GithubIcon} size={16} strokeWidth={2} />
                        <span className="max-w-[150px] truncate">
                          {selectedRepo ? selectedRepo.fullName : 'Select repo'}
                        </span>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} className="opacity-50" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[280px] max-h-[300px] overflow-y-auto">
                        {reposLoading ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            Loading repos...
                          </div>
                        ) : repos.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            No repos found
                          </div>
                        ) : (
                          repos.slice(0, 20).map((repo) => (
                            <DropdownMenuItem
                              key={repo.id}
                              onClick={() => setSelectedRepo(repo)}
                              className="flex items-center gap-2"
                            >
                              <HugeiconsIcon icon={GithubIcon} size={14} strokeWidth={2} className="shrink-0" />
                              <span className="truncate">{repo.fullName}</span>
                              {repo.private && (
                                <span className="ml-auto text-[10px] text-muted-foreground">private</span>
                              )}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Right side: Mic and Send */}
                  <div className="flex items-center gap-1">
                    <button className="inline-flex items-center justify-center size-8 rounded-full hover:bg-accent transition-colors">
                      <HugeiconsIcon icon={Mic01Icon} size={18} strokeWidth={2} />
                    </button>
                    <button 
                      onClick={handleSubmit}
                      disabled={!selectedRepo || !prompt.trim() || isCreating}
                      className={cn(
                        "inline-flex items-center justify-center size-8 rounded-full transition-colors",
                        selectedRepo && prompt.trim() && !isCreating
                          ? "bg-foreground text-background hover:bg-foreground/90" 
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      {isCreating ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <HugeiconsIcon icon={ArrowUp02Icon} size={18} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Model selector below input */}
              <div className="flex items-center justify-between">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {modelsLoading ? 'Loading...' : (selectedModel?.name || 'Select model')}
                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} className="opacity-50" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[220px]">
                    {Object.entries(groupedByProvider).map(([provider, providerModels], idx) => (
                      <div key={provider}>
                        {idx > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-xs text-muted-foreground capitalize">
                          {provider}
                        </DropdownMenuLabel>
                        {providerModels.map((model) => (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => setSelectedModel(model)}
                            className={cn(
                              selectedModel?.id === model.id && "bg-accent"
                            )}
                          >
                            {model.name}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => setMode('build')}
                    className={cn(
                      "transition-colors",
                      mode === 'build' ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    build
                  </button>
                  <button
                    onClick={() => setMode('agent')}
                    className={cn(
                      "transition-colors",
                      mode === 'agent' ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    agent
                  </button>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-4">
                <StatsCard label="Sessions past week" value={stats.sessionsPastWeek} />
                <StatsCard label="Messages past week" value={stats.messagesPastWeek} />
                <StatsCard label="Active repos" value={stats.activeRepos} />
              </div>
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
