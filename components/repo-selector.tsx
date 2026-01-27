'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAtomValue } from 'jotai'
import { sessionAtom } from '@/lib/atoms/session'
import { githubConnectionAtom } from '@/lib/atoms/github-connection'
import { Loader2 } from 'lucide-react'

interface Repo {
  id: number
  name: string
  fullName: string
  description?: string
  private: boolean
  owner: string
  defaultBranch: string
  updatedAt?: string
  language?: string
}

interface RepoSelectorProps {
  selectedOwner: string
  selectedRepo: string
  onOwnerChange: (owner: string) => void
  onRepoChange: (repo: string) => void
}

export function RepoSelector({ selectedOwner, selectedRepo, onOwnerChange, onRepoChange }: RepoSelectorProps) {
  const session = useAtomValue(sessionAtom)
  const githubConnection = useAtomValue(githubConnectionAtom)
  const [repos, setRepos] = useState<Repo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!session.user || !githubConnection.connected) {
      setRepos([])
      return
    }

    const fetchRepos = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/repos')
        if (response.ok) {
          const data = await response.json()
          setRepos(data.repos || [])

          // Auto-select first repo owner if not already selected
          if (!selectedOwner && data.repos?.length > 0) {
            const firstOwner = data.repos[0].owner
            onOwnerChange(firstOwner)
          }
        }
      } catch (error) {
        console.error('Error fetching repos:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRepos()
  }, [session.user, githubConnection.connected, selectedOwner, onOwnerChange])

  // Get unique owners
  const owners = Array.from(new Set(repos.map((repo) => repo.owner)))

  // Filter repos by selected owner
  const filteredRepos = repos.filter((repo) => repo.owner === selectedOwner)

  if (!session.user || !githubConnection.connected) {
    return (
      <div className="text-center p-4 text-muted-foreground text-sm">
        Sign in and connect GitHub to select a repository
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading repositories...
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Owner Selector */}
      <Select value={selectedOwner} onValueChange={(value) => {
        onOwnerChange(value)
        onRepoChange('')
      }}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select owner" />
        </SelectTrigger>
        <SelectContent>
          {owners.map((owner) => (
            <SelectItem key={owner} value={owner}>
              {owner}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground">/</span>

      {/* Repo Selector */}
      <Select value={selectedRepo} onValueChange={onRepoChange} disabled={!selectedOwner}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select repository" />
        </SelectTrigger>
        <SelectContent>
          {filteredRepos.map((repo) => (
            <SelectItem key={repo.id} value={repo.name}>
              <div className="flex items-center gap-2">
                <span>{repo.name}</span>
                {repo.private && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Private
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
