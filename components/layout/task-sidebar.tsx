'use client'

import { Task } from '@/lib/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Plus, Trash2, GitBranch, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTasks } from '@/components/layout/app-layout'
import { useAtomValue } from 'jotai'
import { sessionAtom } from '@/lib/atoms/session'
import { githubConnectionAtom } from '@/lib/atoms/github-connection'

interface TaskSidebarProps {
  tasks: Task[]
  width?: number
}

type TabType = 'tasks' | 'repos'

export function TaskSidebar({ tasks, width = 288 }: TaskSidebarProps) {
  const pathname = usePathname()
  const { refreshTasks, toggleSidebar } = useTasks()
  const session = useAtomValue(sessionAtom)
  const githubConnection = useAtomValue(githubConnectionAtom)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('tasks')
  const [reposLoading] = useState(false)

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      toggleSidebar()
    }
  }

  const handleDeleteTasks = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tasks?action=completed,failed,stopped`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        await refreshTasks()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete tasks')
      }
    } catch (error) {
      console.error('Error deleting tasks:', error)
      toast.error('Failed to delete tasks')
    } finally {
      setIsDeleting(false)
    }
  }

  const getAgentInitial = (agent: string | null) => {
    if (!agent) return '?'
    return agent.charAt(0).toUpperCase()
  }

  if (!session.user) {
    return (
      <div
        className="h-full border-r bg-muted px-2 md:px-3 pt-3 md:pt-5.5 pb-3 md:pb-4 overflow-y-auto flex flex-col"
        style={{ width: `${width}px` }}
      >
        <div className="mb-3 md:mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('tasks')}
                className={cn(
                  'text-xs font-medium tracking-wide transition-colors px-2 py-1 rounded',
                  activeTab === 'tasks'
                    ? 'text-foreground bg-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                Tasks
              </button>
              <button
                onClick={() => setActiveTab('repos')}
                className={cn(
                  'text-xs font-medium tracking-wide transition-colors px-2 py-1 rounded',
                  activeTab === 'repos'
                    ? 'text-foreground bg-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                Repos
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={true} title="Delete Tasks">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Link href="/" onClick={handleLinkClick}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="New Task">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Card>
            <CardContent className="p-3 text-center text-xs text-muted-foreground">
              Sign in to view and create tasks
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full border-r bg-muted px-2 md:px-3 pt-3 md:pt-5.5 pb-3 md:pb-4 overflow-y-auto"
      style={{ width: `${width}px` }}
    >
      <div className="mb-3 md:mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('tasks')}
              className={cn(
                'text-xs font-medium tracking-wide transition-colors px-2 py-1 rounded',
                activeTab === 'tasks'
                  ? 'text-foreground bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('repos')}
              className={cn(
                'text-xs font-medium tracking-wide transition-colors px-2 py-1 rounded',
                activeTab === 'repos'
                  ? 'text-foreground bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              Repos
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleDeleteTasks}
              disabled={isDeleting || tasks.length === 0}
              title="Delete Tasks"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Link href="/" onClick={handleLinkClick}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="New Task">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tasks Tab Content */}
      {activeTab === 'tasks' && (
        <div className="space-y-1">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="p-3 text-center text-xs text-muted-foreground">
                No tasks yet. Create your first task!
              </CardContent>
            </Card>
          ) : (
            <>
              {tasks.slice(0, 10).map((task) => {
                const isActive = pathname === `/tasks/${task.id}`

                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    onClick={handleLinkClick}
                    className={cn('block rounded-lg', isActive && 'ring-1 ring-primary/50 ring-offset-0')}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-accent p-0 rounded-lg',
                        isActive && 'bg-accent',
                      )}
                    >
                      <CardContent className="px-3 py-2">
                        <div className="flex gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h3
                                className={cn(
                                  'text-xs font-medium truncate mb-0.5',
                                  task.status === 'processing' &&
                                    'bg-gradient-to-r from-muted-foreground from-20% via-white via-50% to-muted-foreground to-80% bg-clip-text text-transparent bg-[length:300%_100%] animate-[shimmer_1.5s_linear_infinite]',
                                )}
                              >
                                {(() => {
                                  const displayText = task.title || task.prompt
                                  return displayText.slice(0, 50) + (displayText.length > 50 ? '...' : '')
                                })()}
                              </h3>
                              {task.status === 'error' && (
                                <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                              )}
                              {task.status === 'stopped' && (
                                <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                              )}
                            </div>
                            {task.repoUrl && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                                <span className="truncate">
                                  {(() => {
                                    try {
                                      const url = new URL(task.repoUrl)
                                      const pathParts = url.pathname.split('/').filter(Boolean)
                                      if (pathParts.length >= 2) {
                                        return `${pathParts[0]}/${pathParts[1].replace(/\.git$/, '')}`
                                      }
                                      return 'Unknown repository'
                                    } catch {
                                      return 'Invalid repository URL'
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                            {task.selectedAgent && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="w-3 h-3 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                                  {getAgentInitial(task.selectedAgent)}
                                </span>
                                {task.selectedModel && <span className="truncate">{task.selectedModel}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
              {tasks.length >= 1 && (
                <div className="pt-1">
                  <Link href="/tasks" onClick={handleLinkClick}>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-7 px-2 text-xs">
                      View All Tasks
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Repos Tab Content */}
      {activeTab === 'repos' && (
        <div className="space-y-2">
          <div className="space-y-1">
            {!githubConnection.connected ? (
              <Card>
                <CardContent className="p-3 text-center text-xs text-muted-foreground">
                  Connect GitHub to view your repositories
                </CardContent>
              </Card>
            ) : reposLoading ? (
              <Card>
                <CardContent className="p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading repositories...
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-3 text-center text-xs text-muted-foreground">
                  <GitBranch className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
                  Repository list coming soon
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
