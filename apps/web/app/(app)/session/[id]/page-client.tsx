'use client'

import { useState, useEffect } from 'react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { SessionPanel } from '@/components/session/session-panel'
import { AgentStatus } from '@/components/session/status-indicator'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface SessionPageClientProps {
  sessionId: string
}

export function SessionPageClient({ sessionId }: SessionPageClientProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [currentTool, setCurrentTool] = useState<string>()
  const [sessionInfo, setSessionInfo] = useState({
    repoOwner: '',
    repoName: '',
    branch: undefined as string | undefined,
  })

  // Fetch session info
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          setSessionInfo({
            repoOwner: data.repoOwner,
            repoName: data.repoName,
            branch: data.branch,
          })
        }
      } catch (err) {
        console.error('Failed to load session:', err)
      }
    }
    loadSession()
  }, [sessionId])

  const handleStatusChange = (status: AgentStatus, tool?: string) => {
    setAgentStatus(status)
    setCurrentTool(tool)
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Back
          </Link>
          <h1 className="font-semibold dark:text-white">
            {sessionInfo.repoOwner && sessionInfo.repoName
              ? `${sessionInfo.repoOwner}/${sessionInfo.repoName}`
              : 'Session'}
          </h1>
        </div>
      </header>

      {/* Main content: Chat + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface sessionId={sessionId} onStatusChange={handleStatusChange} />
        </div>

        {/* Side Panel */}
        <SessionPanel
          sessionId={sessionId}
          sessionInfo={sessionInfo}
          agentStatus={agentStatus}
          currentTool={currentTool}
        />
      </div>
    </div>
  )
}
