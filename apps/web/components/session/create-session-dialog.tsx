'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ModelSelector } from '@/components/model/model-selector'
import { cn } from '@/lib/utils'

interface CreateSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { repoOwner: string; repoName: string; model?: string }) => Promise<void>
  userId: string
}

interface GitHubRepo {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  private: boolean
  updatedAt: string
  language: string | null
  stars: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

export function CreateSessionDialog({ isOpen, onClose, onCreate, userId }: CreateSessionDialogProps) {
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen && userId && repos.length === 0) fetchRepos()
  }, [isOpen, userId])

  const fetchRepos = async () => {
    setReposLoading(true)
    setReposError(null)
    try {
      const res = await fetch(`${API_URL}/accounts/github/repos/${userId}`)
      if (!res.ok) {
        setReposError(res.status === 404 ? 'GitHub account not connected. Please re-authenticate.' : 'Failed to fetch repos')
        return
      }
      setRepos(await res.json())
    } catch {
      setReposError('Failed to load repositories')
    } finally {
      setReposLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!selectedRepo) { setError('Please select a repository'); return }
    const [repoOwner, repoName] = selectedRepo.split('/')
    startTransition(async () => {
      try {
        await onCreate({ repoOwner, repoName, model: selectedModel || undefined })
        setSelectedRepo(''); setSelectedModel(''); setSearchQuery(''); onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session')
      }
    })
  }

  const handleClose = () => {
    if (!isPending) { setSelectedRepo(''); setSelectedModel(''); setSearchQuery(''); setError(null); onClose() }
  }

  const filteredRepos = repos.filter(repo => 
    searchQuery === '' || repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <Card className="relative w-full max-w-md shadow-lg">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">New Session</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Select a repository to start building</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Repository</label>
              <Input
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={reposLoading}
                className="mb-2"
              />
              <div className="border border-border rounded-md overflow-hidden max-h-[180px] overflow-y-auto">
                {reposLoading ? (
                  <div className="p-3 text-center">
                    <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto"></div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">Loading...</p>
                  </div>
                ) : reposError ? (
                  <div className="p-3 text-center">
                    <p className="text-[11px] text-destructive mb-1.5">{reposError}</p>
                    <button type="button" onClick={fetchRepos} className="text-[11px] text-muted-foreground hover:text-foreground underline">Try again</button>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">{searchQuery ? 'No matching repositories' : 'No repositories found'}</p>
                  </div>
                ) : (
                  filteredRepos.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => setSelectedRepo(repo.fullName)}
                      className={cn(
                        'w-full px-2.5 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between border-b border-border last:border-b-0',
                        selectedRepo === repo.fullName && 'bg-accent'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[12px] truncate', selectedRepo === repo.fullName ? 'text-foreground font-medium' : 'text-foreground')}>{repo.fullName}</p>
                        {repo.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{repo.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {repo.language && <Badge variant="secondary" className="text-[9px] px-1 py-0">{repo.language}</Badge>}
                        {repo.private && (
                          <svg className="w-3 h-3 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        {selectedRepo === repo.fullName && (
                          <svg className="w-3.5 h-3.5 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">AI Model</label>
              <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isPending} placeholder="Default (Claude Opus 4.5)" />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-[11px] text-destructive">{error}</p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending || !selectedRepo}>
              {isPending ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
