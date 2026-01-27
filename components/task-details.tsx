'use client'

import { Task } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  GitBranch,
  CheckCircle,
  AlertCircle,
  Loader2,
  Square,
  GitPullRequest,
  Trash2,
  Code,
  MessageSquare,
  Monitor,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTasks } from '@/components/layout/app-layout'
import { SharedHeader } from '@/components/layout/shared-header'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface TaskDetailsProps {
  task: Task
}

interface Message {
  id: string
  taskId: string
  role: 'user' | 'agent'
  content: string
  createdAt: Date
}

export function TaskDetails({ task }: TaskDetailsProps) {
  const router = useRouter()
  const { refreshTasks } = useTasks()
  const [isStopping, setIsStopping] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeTab, setActiveTab] = useState<string>('code')

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/tasks/${task.id}/messages`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      }
    }

    fetchMessages()

    // Poll for messages every 3 seconds if task is processing
    if (task.status === 'processing' || task.status === 'pending') {
      const interval = setInterval(fetchMessages, 3000)
      return () => clearInterval(interval)
    }
  }, [task.id, task.status])

  const handleStopTask = async () => {
    setIsStopping(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })

      if (response.ok) {
        toast.success('Task stopped')
        refreshTasks()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      toast.error('Failed to stop task')
    } finally {
      setIsStopping(false)
    }
  }

  const handleDeleteTask = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Task deleted')
        refreshTasks()
        router.push('/')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusIcon = () => {
    switch (task.status) {
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

  const getStatusText = () => {
    switch (task.status) {
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Failed'
      case 'stopped':
        return 'Stopped'
      case 'processing':
        return 'Processing'
      case 'pending':
        return 'Pending'
      default:
        return task.status
    }
  }

  const getRepoInfo = () => {
    if (!task.repoUrl) return null
    try {
      const url = new URL(task.repoUrl)
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        return `${pathParts[0]}/${pathParts[1].replace(/\.git$/, '')}`
      }
    } catch {
      return null
    }
    return null
  }

  const repoInfo = getRepoInfo()

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 md:px-6">
        <SharedHeader
          leftActions={
            <div className="flex items-center gap-2 min-w-0">
              {repoInfo && (
                <Link
                  href={task.repoUrl?.replace('.git', '') || '#'}
                  target="_blank"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <GitBranch className="h-4 w-4" />
                  <span className="truncate">{repoInfo}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          }
          extraActions={
            <div className="flex items-center gap-2">
              {task.status === 'processing' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopTask}
                  disabled={isStopping}
                  className="h-8"
                >
                  {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  Stop
                </Button>
              )}
              {task.status === 'completed' && !task.prUrl && (
                <Button variant="outline" size="sm" className="h-8">
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  Create PR
                </Button>
              )}
              {task.prUrl && (
                <Button variant="outline" size="sm" className="h-8" asChild>
                  <a href={task.prUrl} target="_blank" rel="noopener noreferrer">
                    <GitPullRequest className="h-4 w-4 mr-2" />
                    View PR
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 p-3 md:p-6 overflow-auto">
        {/* Task Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold mb-2 truncate">{task.title || task.prompt}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="flex items-center gap-1">
                  {getStatusIcon()}
                  {getStatusText()}
                </Badge>
                {task.selectedAgent && (
                  <Badge variant="secondary" className="capitalize">
                    {task.selectedAgent}
                  </Badge>
                )}
                {task.selectedModel && (
                  <Badge variant="secondary">{task.selectedModel}</Badge>
                )}
                {task.branchName && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {task.branchName}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {task.status === 'processing' && task.progress !== null && (
            <div className="space-y-2">
              <Progress value={task.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{task.progress}% complete</p>
            </div>
          )}

          {/* Error Message */}
          {task.error && (
            <Card className="border-destructive bg-destructive/5 mt-4">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">{task.error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="mb-4">
            <TabsTrigger value="code" className="gap-2">
              <Code className="h-4 w-4" />
              Code
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Monitor className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Code browser coming soon. File changes will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-center text-sm text-muted-foreground">
                    No messages yet
                  </CardContent>
                </Card>
              ) : (
                messages.map((message) => (
                  <Card
                    key={message.id}
                    className={cn(
                      message.role === 'user' ? 'ml-8' : 'mr-8',
                      message.role === 'user' ? 'bg-primary/5' : 'bg-muted/50'
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {message.role === 'user' ? 'You' : 'Agent'}
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {task.sandboxUrl ? (
              <div className="border rounded-lg overflow-hidden h-[600px]">
                <iframe
                  src={task.sandboxUrl}
                  className="w-full h-full"
                  sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation"
                />
              </div>
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-sm text-muted-foreground">
                  {task.status === 'processing'
                    ? 'Preview will be available when the sandbox is ready'
                    : 'No preview available'}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
