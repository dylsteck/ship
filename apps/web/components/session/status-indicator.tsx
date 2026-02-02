'use client'

import { useState } from 'react'

export type AgentStatus = 'idle' | 'planning' | 'coding' | 'testing' | 'waiting' | 'error'

interface StatusIndicatorProps {
  status: AgentStatus
  currentTool?: string
  expanded?: boolean
  onToggleExpand?: () => void
}

const statusConfig: Record<AgentStatus, { label: string; color: string; animate: boolean }> = {
  idle: { label: 'Idle', color: 'bg-gray-400', animate: false },
  planning: { label: 'Planning', color: 'bg-blue-500', animate: true },
  coding: { label: 'Coding', color: 'bg-green-500', animate: true },
  testing: { label: 'Testing', color: 'bg-purple-500', animate: true },
  waiting: { label: 'Waiting', color: 'bg-yellow-500', animate: true },
  error: { label: 'Error', color: 'bg-red-500', animate: false },
}

export function StatusIndicator({ status, currentTool, expanded, onToggleExpand }: StatusIndicatorProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-medium">{config.label}</span>

      {currentTool && (
        <button
          onClick={onToggleExpand}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {expanded ? 'Hide' : 'Show'} details
        </button>
      )}

      {expanded && currentTool && (
        <span className="text-xs text-gray-500 font-mono dark:text-gray-400">{currentTool}</span>
      )}
    </div>
  )
}
