'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { FolderGit2, Search, Loader2, GitBranch } from 'lucide-react'

interface Repository {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  default_branch: string
}

interface MultiRepoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (repos: Repository[]) => void
  maxSelection?: number
}

export function MultiRepoDialog({ open, onOpenChange, onSelect, maxSelection = 5 }: MultiRepoDialogProps) {
  const [repos, setRepos] = useState<Repository[]>([])
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const fetchRepos = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/repos')
      if (response.ok) {
        const data = await response.json()
        setRepos(data.repos || [])
      }
    } catch (error) {
      console.error('Failed to fetch repos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchRepos()
      setSelectedRepos(new Set())
      setSearchQuery('')
    }
  }, [open])

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleRepo = (repoId: number) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(repoId)) {
        next.delete(repoId)
      } else if (next.size < maxSelection) {
        next.add(repoId)
      }
      return next
    })
  }

  const handleSubmit = () => {
    const selected = repos.filter((repo) => selectedRepos.has(repo.id))
    onSelect(selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            Select Repositories
          </DialogTitle>
          <DialogDescription>
            Select up to {maxSelection} repositories to work with. {selectedRepos.size} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="pl-9"
            />
          </div>

          {/* Repository list */}
          <div className="max-h-[300px] overflow-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {searchQuery ? 'No repositories match your search' : 'No repositories found'}
              </p>
            ) : (
              filteredRepos.map((repo) => (
                <Card
                  key={repo.id}
                  className={`cursor-pointer transition-colors ${
                    selectedRepos.has(repo.id) ? 'border-primary' : ''
                  }`}
                  onClick={() => toggleRepo(repo.id)}
                >
                  <CardContent className="p-3 flex items-start gap-3">
                    <Checkbox
                      checked={selectedRepos.has(repo.id)}
                      onCheckedChange={() => toggleRepo(repo.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{repo.full_name}</p>
                        {repo.private && (
                          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">Private</span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        {repo.default_branch}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedRepos.size === 0}>
            Select {selectedRepos.size > 0 ? `(${selectedRepos.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
