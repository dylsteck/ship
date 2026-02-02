'use client'

import { useState } from 'react'

export type AgentStatus = 'idle' | 'planning' | 'coding' | 'testing' | 'executing' | 'stuck' | 'waiting' | 'error'

interface StatusIndicatorProps {
  status: AgentStatus
  currentTool?: string
  expanded?: boolean
  onToggleExpand?: () => void
}

const statusConfig: Record<AgentStatus, { label: string; color: string; bgColor: string; animate: boolean }> = {
  idle: { label: 'Idle', color: 'text-gray-500', bgColor: 'bg-gray-400', animate: false },
  planning: { label: 'Planning', color: 'text-blue-600', bgColor: 'bg-blue-500', animate: true },
  coding: { label: 'Coding', color: 'text-green-600', bgColor: 'bg-green-500', animate: true },
  testing: { label: 'Testing', color: 'text-purple-600', bgColor: 'bg-purple-500', animate: true },
  executing: { label: 'Executing', color: 'text-green-600', bgColor: 'bg-green-500', animate: true },
  stuck: { label: 'Stuck', color: 'text-yellow-600', bgColor: 'bg-yellow-500', animate: true },
  waiting: { label: 'Waiting', color: 'text-yellow-600', bgColor: 'bg-yellow-500', animate: true },
  error: { label: 'Error', color: 'text-red-600', bgColor: 'bg-red-500', animate: false },
}

export function StatusIndicator({ status, currentTool, expanded, onToggleExpand }: StatusIndicatorProps) {
  const config = statusConfig[status] || statusConfig.idle

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className={`h-2.5 w-2.5 rounded-full ${config.bgColor} ${config.animate ? 'animate-pulse' : ''}`} />
          {config.animate && (
            <div
              className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${config.bgColor} animate-ping opacity-75`}
            />
          )}
        </div>
        <span className={`text-sm font-medium ${config.color} dark:${config.color.replace('text-', 'dark:text-')}`}>
          {config.label}
        </span>

        {currentTool && (
          <button
            onClick={onToggleExpand}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            {expanded ? 'Hide' : 'Show'} details
          </button>
        )}
      </div>

      {expanded && currentTool && (
        <div className="ml-4 rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-800/50">
          <span className="text-xs text-gray-600 font-mono dark:text-gray-400">{currentTool}</span>
        </div>
      )}
    </div>
  )
}
