'use client'

import { Task } from '@/lib/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SharedHeader } from '@/components/layout/shared-header'
import { AlertCircle, CheckCircle, Loader2, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface TasksListClientProps {
  initialTasks: Task[]
}

export function TasksListClient({ initialTasks }: TasksListClientProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'stopped':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      default:
        return <Loader2 className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getRepoName = (repoUrl: string | null) => {
    if (!repoUrl) return null
    try {
      const url = new URL(repoUrl)
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        return `${pathParts[0]}/${pathParts[1].replace(/\.git$/, '')}`
      }
    } catch {
      return null
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 md:px-6">
        <SharedHeader
          leftActions={<h1 className="text-lg font-semibold">All Tasks</h1>}
        />
      </div>

      <div className="flex-1 p-3 md:p-6 overflow-auto">
        {initialTasks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No tasks yet. Create your first task from the home page!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {initialTasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium truncate flex-1">
                        {task.title || task.prompt.slice(0, 50) + (task.prompt.length > 50 ? '...' : '')}
                      </h3>
                      {getStatusIcon(task.status)}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {task.prompt}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {task.repoUrl && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {getRepoName(task.repoUrl)}
                        </Badge>
                      )}
                      {task.selectedAgent && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {task.selectedAgent}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
