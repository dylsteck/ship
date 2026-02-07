/**
 * Subagent Detection Utilities
 *
 * Helper functions to detect and extract information from subagent tool invocations.
 */

import type { ToolInvocation } from '@/lib/ai-elements-adapter'

/**
 * Detects if a ToolInvocation represents a subagent task that should be viewable
 */
export function isSubagentToolInvocation(tool: ToolInvocation): boolean {
  // Primary check: toolName is 'task' and has subagent_type in args
  if (tool.toolName === 'task' && tool.args?.subagent_type) {
    return true
  }

  // Alternative: Check if metadata contains a sessionId reference
  if (tool.args?.metadata && typeof tool.args.metadata === 'object') {
    const metadata = tool.args.metadata as Record<string, unknown>
    if (metadata.sessionId || metadata.session_id) {
      return true
    }
  }
  if (tool.result && typeof tool.result === 'object') {
    const result = tool.result as Record<string, unknown>
    if (result.sessionId || result.session_id) {
      return true
    }
  }

  // Legacy support: Check for nested session data in result
  if (typeof tool.result === 'object' && tool.result !== null) {
    const result = tool.result as Record<string, unknown>
    if (result.subagent_session_id || result.child_session_id) {
      return true
    }
  }

  // Check for session_id in args directly
  if (typeof tool.args?.session_id === 'string' || typeof tool.args?.sessionId === 'string') {
    return true
  }

  return false
}

/**
 * Extracts the subagent session ID from a tool invocation
 */
export function extractSubagentSessionId(tool: ToolInvocation): string | null {
  // Check args.metadata first (most common in OpenCode)
  if (typeof tool.args?.metadata === 'object' && tool.args.metadata !== null) {
    const metadata = tool.args.metadata as Record<string, unknown>
    if (typeof metadata.sessionId === 'string') return metadata.sessionId
    if (typeof metadata.session_id === 'string') return metadata.session_id
  }

  // Check result for session ID
  if (typeof tool.result === 'object' && tool.result !== null) {
    const result = tool.result as Record<string, unknown>
    const sessionId = result.sessionId || result.session_id || result.subagent_session_id || result.child_session_id
    if (typeof sessionId === 'string') return sessionId
  }

  // Check args directly
  if (typeof tool.args?.sessionId === 'string') {
    return tool.args.sessionId
  }
  if (typeof tool.args?.session_id === 'string') {
    return tool.args.session_id
  }

  return null
}

/**
 * Gets the display title for a subagent task
 */
export function getSubagentTaskTitle(tool: ToolInvocation): string {
  // Use explicit title if available
  if (tool.title) return tool.title

  // Use subagent_type as title
  if (typeof tool.args?.subagent_type === 'string') {
    const subagentType = tool.args.subagent_type as string
    return `${subagentType.charAt(0).toUpperCase() + subagentType.slice(1)} Task`
  }

  // Fallback to description or default
  if (typeof tool.args?.description === 'string') {
    return tool.args.description
  }

  return 'Subagent Task'
}

/**
 * Gets the subagent type (e.g., 'research', 'code_review')
 */
export function getSubagentType(tool: ToolInvocation): string | null {
  if (typeof tool.args?.subagent_type === 'string') {
    return tool.args.subagent_type
  }
  return null
}

/**
 * Gets a description for the subagent task
 */
export function getSubagentDescription(tool: ToolInvocation): string | null {
  if (typeof tool.args?.description === 'string') {
    return tool.args.description
  }
  if (typeof tool.args?.prompt === 'string') {
    // Truncate long prompts
    const prompt = tool.args.prompt as string
    return prompt.length > 100 ? prompt.slice(0, 97) + '...' : prompt
  }
  return null
}
