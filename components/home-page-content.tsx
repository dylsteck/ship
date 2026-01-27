'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskForm } from '@/components/task-form'
import { RepoSelector } from '@/components/repo-selector'
import { SharedHeader } from '@/components/layout/shared-header'
import { useTasks } from '@/components/layout/app-layout'
import { useAtomValue } from 'jotai'
import { sessionAtom } from '@/lib/atoms/session'
import { toast } from 'sonner'

export function HomePageContent() {
  const router = useRouter()
  const { addTaskOptimistically } = useTasks()
  const session = useAtomValue(sessionAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState('')
  const [selectedRepo, setSelectedRepo] = useState('')

  const handleSubmit = async (data: {
    prompt: string
    repoUrl: string
    selectedAgent: string
    selectedModel: string
    installDependencies: boolean
    maxDuration: number
    keepAlive: boolean
    enableBrowser: boolean
  }) => {
    if (!session.user) {
      toast.error('Please sign in to create a task')
      return
    }

    if (!selectedOwner || !selectedRepo) {
      toast.error('Please select a repository')
      return
    }

    setIsSubmitting(true)

    try {
      // Add optimistic task
      const { id: optimisticId } = addTaskOptimistically({
        prompt: data.prompt,
        repoUrl: data.repoUrl,
        selectedAgent: data.selectedAgent,
        selectedModel: data.selectedModel,
        installDependencies: data.installDependencies,
        maxDuration: data.maxDuration,
      })

      // Create the task via API
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: optimisticId,
          prompt: data.prompt,
          repoUrl: data.repoUrl,
          selectedAgent: data.selectedAgent,
          selectedModel: data.selectedModel,
          installDependencies: data.installDependencies,
          maxDuration: data.maxDuration,
          keepAlive: data.keepAlive,
          enableBrowser: data.enableBrowser,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create task')
      }

      const result = await response.json()
      router.push(`/tasks/${result.task.id}`)
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 md:px-6">
        <SharedHeader />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 min-h-0">
        <div className="w-full max-w-2xl space-y-6">
          <RepoSelector
            selectedOwner={selectedOwner}
            selectedRepo={selectedRepo}
            onOwnerChange={setSelectedOwner}
            onRepoChange={setSelectedRepo}
          />

          <TaskForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            selectedOwner={selectedOwner}
            selectedRepo={selectedRepo}
          />
        </div>
      </div>
    </div>
  )
}
