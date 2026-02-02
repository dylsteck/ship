'use client'

import { useEffect, useState } from 'react'
import { StatusIndicator, AgentStatus } from './status-indicator'
import { PRPanel } from '../git/pr-panel'

interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  mode: 'build' | 'plan'
  createdAt: number
}

interface SessionInfo {
  repoOwner: string
  repoName: string
  branch?: string
}

interface SessionPanelProps {
  sessionId: string
  sessionInfo: SessionInfo
  agentStatus: AgentStatus
  currentTool?: string
}

interface GitState {
  branchName: string | null
  pr: {
    number: number
    url: string
    draft: boolean
  } | null
  repoUrl: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

export function SessionPanel({ sessionId, sessionInfo, agentStatus, currentTool }: SessionPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showStatusDetails, setShowStatusDetails] = useState(false)
  const [gitState, setGitState] = useState<GitState | null>(null)

  // Fetch tasks
  useEffect(() => {
    async function loadTasks() {
      try {
        const res = await fetch(`${API_URL}/chat/${sessionId}/tasks`)
        if (res.ok) {
          setTasks(await res.json())
        }
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }
    loadTasks()

    // Refresh every 5 seconds while agent is active
    if (agentStatus !== 'idle' && agentStatus !== 'error') {
      const interval = setInterval(loadTasks, 5000)
      return () => clearInterval(interval)
    }
  }, [sessionId, agentStatus])

  // Fetch git state (branch, PR info)
  useEffect(() => {
    async function loadGitState() {
      try {
        const res = await fetch(`${API_URL}/chat/${sessionId}/git/state`)
        if (res.ok) {
          setGitState(await res.json())
        }
      } catch (err) {
        console.error('Failed to load git state:', err)
      }
    }
    loadGitState()

    // Poll every 10 seconds for PR updates
    const interval = setInterval(loadGitState, 10000)
    return () => clearInterval(interval)
  }, [sessionId])

  // Handle Mark Ready for Review action
  const handleMarkPRReady = async () => {
    try {
      const res = await fetch(`${API_URL}/chat/${sessionId}/git/pr/ready`, {
        method: 'POST',
      })
      if (res.ok) {
        // Refresh git state immediately
        const stateRes = await fetch(`${API_URL}/chat/${sessionId}/git/state`)
        if (stateRes.ok) {
          setGitState(await stateRes.json())
        }
      }
    } catch (err) {
      console.error('Failed to mark PR ready:', err)
      throw err
    }
  }

  const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'running')
  const completedTasks = tasks.filter((t) => t.status === 'complete')

  return (
    <div className="w-64 border-l bg-gray-50 flex flex-col dark:border-gray-800 dark:bg-gray-900">
      {/* Repo Context */}
      <div className="p-4 border-b dark:border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Repository</h3>
        <div className="font-medium text-sm dark:text-gray-200">
          {sessionInfo.repoOwner}/{sessionInfo.repoName}
        </div>
        {sessionInfo.branch && (
          <div className="text-xs text-gray-500 mt-1 font-mono dark:text-gray-400">{sessionInfo.branch}</div>
        )}
      </div>

      {/* Agent Status */}
      <div className="p-4 border-b dark:border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Status</h3>
        <StatusIndicator
          status={agentStatus}
          currentTool={currentTool}
          expanded={showStatusDetails}
          onToggleExpand={() => setShowStatusDetails(!showStatusDetails)}
        />
      </div>

      {/* Pull Request Panel */}
      <PRPanel
        prNumber={gitState?.pr?.number}
        prUrl={gitState?.pr?.url}
        isDraft={gitState?.pr?.draft}
        onMarkReady={handleMarkPRReady}
      />

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="p-4 border-b dark:border-gray-800">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">
            Active Tasks ({activeTasks.length})
          </h3>
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <div
                key={task.id}
                className={`p-2 rounded text-sm ${
                  task.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                <div className="font-medium dark:text-gray-200">{task.title}</div>
                <div className="text-xs text-gray-500 capitalize dark:text-gray-400">
                  {task.mode} mode - {task.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-1">
            {completedTasks.slice(-5).map((task) => (
              <div key={task.id} className="text-xs text-gray-500 dark:text-gray-400">
                {task.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
