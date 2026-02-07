/**
 * Subagent Types
 *
 * Type definitions for subagent sessions, tools, and UI state.
 */

import type { ToolInvocation, UIMessage } from '@/lib/ai-elements-adapter'

// ============ Subagent Session Types ============

export interface SubagentSessionInfo {
  id: string
  parentSessionId: string
  parentToolCallId: string
  subagentType: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: {
    currentStep: number
    totalSteps: number
    currentTool?: string
  }
  createdAt: number
  completedAt?: number
  summary?: string
  cost?: number
  tokens?: {
    input: number
    output: number
    reasoning?: number
  }
}

// ============ Subagent Tool Types ============

export interface SubagentToolInvocation extends ToolInvocation {
  isSubagent: true
  subagentSessionId: string
  subagentType: string
}

// ============ Subagent Message Types ============

export interface SubagentMessage extends UIMessage {
  subagentSessionId: string
  parentMessageId?: string
}

// ============ Subagent View State ============

export interface SubagentViewState {
  sessionId: string | null
  isOpen: boolean
  parentToolCallId: string | null
  toolName: string | null
}

// ============ API Response Types ============

export interface SubagentSessionResponse {
  session: SubagentSessionInfo
  messages: SubagentMessage[]
  tools: SubagentToolInvocation[]
  hasMore: boolean
  nextCursor?: string
}

export interface SubagentListResponse {
  sessions: SubagentSessionInfo[]
  total: number
}
