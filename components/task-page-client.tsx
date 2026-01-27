'use client'

import { useState, useEffect } from 'react'
import { Task } from '@/lib/db/schema'
import { TaskDetails } from '@/components/task-details'

interface TaskPageClientProps {
  initialTask: Task
}

export function TaskPageClient({ initialTask }: TaskPageClientProps) {
  const [task, setTask] = useState<Task>(initialTask)

  // Poll for task updates every 3 seconds
  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/tasks/${task.id}`)
        if (response.ok) {
          const data = await response.json()
          setTask(data.task)
        }
      } catch (error) {
        console.error('Error fetching task:', error)
      }
    }

    // Only poll if task is not in a terminal state
    if (task.status !== 'completed' && task.status !== 'error' && task.status !== 'stopped') {
      const interval = setInterval(fetchTask, 3000)
      return () => clearInterval(interval)
    }
  }, [task.id, task.status])

  return <TaskDetails task={task} />
}
