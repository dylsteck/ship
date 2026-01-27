'use client'

import { useState, useEffect } from 'react'
import { SharedHeader } from '@/components/layout/shared-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GitCommit,
  GitPullRequest,
  CircleDot,
  ExternalLink,
  Loader2,
  GitBranch,
  User,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Commit {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

interface Issue {
  number: number
  title: string
  state: 'open' | 'closed'
  author: string
  createdAt: string
  url: string
  labels: { name: string; color: string }[]
}

interface PullRequest {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  author: string
  createdAt: string
  url: string
  head: string
  base: string
}

interface RepoPageClientProps {
  owner: string
  repo: string
}

export function RepoPageClient({ owner, repo }: RepoPageClientProps) {
  const [activeTab, setActiveTab] = useState('commits')
  const [commits, setCommits] = useState<Commit[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = async (tab: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/repos/${owner}/${repo}/${tab}`)
      if (response.ok) {
        const data = await response.json()
        if (tab === 'commits') setCommits(data.commits || [])
        if (tab === 'issues') setIssues(data.issues || [])
        if (tab === 'pulls') setPullRequests(data.pulls || [])
      }
    } catch (error) {
      console.error(`Failed to fetch ${tab}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab, owner, repo])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 md:px-6">
        <SharedHeader
          leftActions={
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {owner}/{repo}
              </h1>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={`https://github.com/${owner}/${repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 p-3 md:p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="commits" className="flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              Commits
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <CircleDot className="h-4 w-4" />
              Issues
            </TabsTrigger>
            <TabsTrigger value="pulls" className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              Pull Requests
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="commits" className="mt-4">
                <CommitsList commits={commits} />
              </TabsContent>
              <TabsContent value="issues" className="mt-4">
                <IssuesList issues={issues} />
              </TabsContent>
              <TabsContent value="pulls" className="mt-4">
                <PullRequestsList pullRequests={pullRequests} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  )
}

function CommitsList({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">No commits found</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {commits.map((commit) => (
        <Card key={commit.sha}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:underline line-clamp-1"
                >
                  {commit.message}
                </a>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {commit.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(commit.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{commit.sha.slice(0, 7)}</code>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function IssuesList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">No issues found</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <Card key={issue.number}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CircleDot
                    className={cn('h-4 w-4', issue.state === 'open' ? 'text-green-500' : 'text-purple-500')}
                  />
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:underline"
                  >
                    {issue.title}
                  </a>
                  <span className="text-muted-foreground text-sm">#{issue.number}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {issue.labels.map((label) => (
                    <Badge
                      key={label.name}
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>by {issue.author}</span>
                  <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PullRequestsList({ pullRequests }: { pullRequests: PullRequest[] }) {
  if (pullRequests.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">No pull requests found</CardContent>
      </Card>
    )
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'text-green-500'
      case 'closed':
        return 'text-red-500'
      case 'merged':
        return 'text-purple-500'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="space-y-2">
      {pullRequests.map((pr) => (
        <Card key={pr.number}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <GitPullRequest className={cn('h-4 w-4', getStateColor(pr.state))} />
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:underline"
                  >
                    {pr.title}
                  </a>
                  <span className="text-muted-foreground text-sm">#{pr.number}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {pr.head} → {pr.base}
                  </span>
                  <span>by {pr.author}</span>
                  <span>{new Date(pr.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <Badge variant="outline" className={cn('capitalize', getStateColor(pr.state))}>
                {pr.state}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
