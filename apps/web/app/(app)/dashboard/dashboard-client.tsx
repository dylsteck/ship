'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSession } from '@/lib/api'
import { CreateSessionDialog } from '@/components/session/create-session-dialog'
import {
  Card,
  Button,
  Textarea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  cn,
} from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Mic01Icon, AttachmentIcon, ArrowUp01Icon, GithubIcon } from '@hugeicons/core-free-icons'

interface User {
  id: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

const MODELS = [
  { id: 'claude-opus-4.5', name: 'claude opus 4.5' },
  { id: 'claude-sonnet-4', name: 'claude sonnet 4' },
  { id: 'gpt-4o', name: 'gpt-4o' },
]

const REPOS = [
  { owner: 'Ramp', name: 'Inspect' },
  { owner: 'vercel', name: 'next.js' },
  { owner: 'facebook', name: 'react' },
]

function AreaChart({ color = 'hsl(var(--chart-1))' }: { color?: string }) {
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
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; name: string } | null>(null)
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [mode, setMode] = useState<'build' | 'agent'>('build')
  const [prompt, setPrompt] = useState('')
  const router = useRouter()

  const handleCreate = async (data: { repoOwner: string; repoName: string; model?: string }) => {
    const res = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, repoOwner: data.repoOwner, repoName: data.repoName }),
    })
    if (!res.ok) throw new Error('Failed to create session')
    const newSession = await res.json()
    router.push(`/session/${newSession.id}`)
  }

  const handleSubmit = () => {
    if (!selectedRepo || !prompt.trim()) return
    handleCreate({ repoOwner: selectedRepo.owner, repoName: selectedRepo.name, model: selectedModel.id })
  }

  const stats = {
    mergesPastWeek: 1307,
    authorsPastWeek: 202,
    humansPastWeek: 275,
  }

  // For demo, show 1 human prompting (the current user)
  const humansPrompting = 1

  return (
    <SidebarProvider>
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
          <header className="flex items-center gap-2 p-2 relative z-10">
            <SidebarTrigger />
          </header>

          {/* Main content */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
            <div className="w-full max-w-[540px] space-y-6">
              {/* Input Card */}
              <Card className="overflow-hidden">
                {/* Text input area */}
                <div className="p-4 pb-2">
                  <Textarea
                    placeholder="Ask or build anything"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[60px] resize-none border-0 p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0 shadow-none"
                  />
                </div>

                {/* Repo selector and action buttons */}
                <div className="px-4 pb-2 flex items-center justify-between">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-normal h-8 gap-1.5 px-3 hover:bg-accent hover:text-accent-foreground transition-colors">
                      <HugeiconsIcon icon={GithubIcon} strokeWidth={2} className="size-4" />
                      {selectedRepo ? `${selectedRepo.owner}/${selectedRepo.name}` : 'Select repo'}
                      <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3 opacity-50" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px]">
                      {REPOS.map((repo) => (
                        <DropdownMenuItem
                          key={`${repo.owner}/${repo.name}`}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          <HugeiconsIcon icon={GithubIcon} strokeWidth={2} className="size-4 mr-2" />
                          {repo.owner}/{repo.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8">
                      <HugeiconsIcon icon={Mic01Icon} strokeWidth={2} className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8">
                      <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} className="size-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8"
                      onClick={handleSubmit}
                      disabled={!selectedRepo || !prompt.trim()}
                    >
                      <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Bottom bar: model selector + mode selector */}
                <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-muted/30">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md h-7 gap-1 px-2 text-xs text-muted-foreground font-normal hover:bg-accent hover:text-accent-foreground transition-colors">
                      {selectedModel.name}
                      <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-2.5 opacity-50" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {MODELS.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => setSelectedModel(model)}
                        >
                          {model.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex items-center gap-2 text-sm">
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
              </Card>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-4">
                <StatsCard label="Merges past week" value={stats.mergesPastWeek} />
                <StatsCard label="Authors past week" value={stats.authorsPastWeek} />
                <StatsCard label="Humans past week" value={stats.humansPastWeek} />
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="py-4 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
              <span>{humansPrompting} {humansPrompting === 1 ? 'human' : 'humans'} prompting</span>
            </div>
          </footer>
        </div>
      </SidebarInset>

      <CreateSessionDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onCreate={handleCreate} userId={userId} />
    </SidebarProvider>
  )
}
