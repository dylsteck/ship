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
  // Early check: if args contain subagent_type, it's a subagent regardless of toolName
  // (toolName can get transformed from "task" to a description string during event replay)
  if (typeof tool.args?.subagent_type === 'string') {
    return true
  }

  const lowerName = tool.toolName.toLowerCase()

  // Primary check: toolName is 'task' and has subagent_type in args
  if (lowerName === 'task' && tool.args?.subagent_type) {
    return true
  }

  // Check for agent-like tool names
  if (lowerName.includes('task') && (tool.args?.subagent_type || tool.args?.prompt)) {
    return true
  }

  // Alternative: Check if metadata contains a sessionId reference
  if (tool.args?.metadata && typeof tool.args.metadata === 'object') {
    const metadata = tool.args.metadata as Record<string, unknown>
    if (metadata.sessionId || metadata.session_id || metadata.sessionID) {
      return true
    }
  }
  if (tool.result && typeof tool.result === 'object') {
    const result = tool.result as Record<string, unknown>
    if (result.sessionId || result.session_id || result.sessionID) {
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

/** Try to extract session_id from JSON string (handles partial streaming output) */
function extractSessionIdFromJsonLike(str: string): string | null {
  if (!str || typeof str !== 'string') return null
  // Try full parse first
  try {
    const parsed = JSON.parse(str) as Record<string, unknown>
    const id =
      parsed.sessionId ?? parsed.session_id ?? parsed.sessionID ?? parsed.subagent_session_id ?? parsed.child_session_id
    if (typeof id === 'string') return id
  } catch {
    // Partial JSON — use regex to find session_id: "uuid"
    const m = str.match(
      /["']?(?:session_id|sessionId|sessionID|subagent_session_id|child_session_id)["']?\s*:\s*["']([a-f0-9-]{36})["']/i,
    )
    if (m?.[1]) return m[1]
  }
  return null
}

/**
 * Extracts the subagent session ID from a tool invocation
 */
export function extractSubagentSessionId(tool: ToolInvocation): string | null {
  // Check tool-level metadata first (from ToolPart.state.metadata via SSE)
  if (typeof tool.metadata === 'object' && tool.metadata !== null) {
    if (typeof tool.metadata.sessionId === 'string') return tool.metadata.sessionId
    if (typeof tool.metadata.session_id === 'string') return tool.metadata.session_id
    if (typeof tool.metadata.sessionID === 'string') return tool.metadata.sessionID
  }

  // Check args.metadata (most common in OpenCode)
  if (typeof tool.args?.metadata === 'object' && tool.args.metadata !== null) {
    const metadata = tool.args.metadata as Record<string, unknown>
    if (typeof metadata.sessionId === 'string') return metadata.sessionId
    if (typeof metadata.session_id === 'string') return metadata.session_id
    if (typeof metadata.sessionID === 'string') return metadata.sessionID
  }

  // Check result for session ID (object or string JSON)
  if (typeof tool.result === 'object' && tool.result !== null) {
    const result = tool.result as Record<string, unknown>
    const sessionId = result.sessionId || result.session_id || result.sessionID || result.subagent_session_id || result.child_session_id
    if (typeof sessionId === 'string') return sessionId
  }
  if (typeof tool.result === 'string') {
    const id = extractSessionIdFromJsonLike(tool.result)
    if (id) return id
  }

  // Check streaming raw output (session_id may appear before tool completes)
  if (tool.rawOutput) {
    const id = extractSessionIdFromJsonLike(tool.rawOutput)
    if (id) return id
  }

  // Check args directly
  if (typeof tool.args?.sessionId === 'string') return tool.args.sessionId
  if (typeof tool.args?.session_id === 'string') return tool.args.session_id

  return null
}

/**
 * Gets the display title for a subagent task
 */
export function getSubagentTaskTitle(tool: ToolInvocation): string {
  if (tool.title) return tool.title

  if (typeof tool.args?.subagent_type === 'string') {
    const subagentType = tool.args.subagent_type as string
    return `${subagentType.charAt(0).toUpperCase() + subagentType.slice(1)} Task`
  }

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
    const prompt = tool.args.prompt as string
    return prompt.length > 200 ? prompt.slice(0, 197) + '...' : prompt
  }
  return null
}

/**
 * Get the full prompt for a subagent (untruncated)
 */
export function getSubagentFullPrompt(tool: ToolInvocation): string | null {
  if (typeof tool.args?.prompt === 'string') {
    return tool.args.prompt as string
  }
  if (typeof tool.args?.description === 'string') {
    return tool.args.description
  }
  return null
}

/**
 * Extract child tool info from a subagent's result text (heuristic)
 */
export function extractChildToolsFromResult(tool: ToolInvocation): { name: string; status: string; title?: string }[] {
  // The tool invocations on the same message that come after this sub-agent tool
  // aren't stored here — they're in the child session.
  // But we can check if the result is an object with tool info
  if (typeof tool.result === 'object' && tool.result !== null) {
    const result = tool.result as Record<string, unknown>
    if (Array.isArray(result.tools)) {
      return (result.tools as Array<{ name?: string; status?: string; title?: string }>)
        .filter((t) => t.name)
        .map((t) => ({ name: t.name!, status: t.status || 'completed', title: t.title }))
    }
  }
  return []
}

/**
 * Returns true if the result would display as a raw JSON blob (no human-readable content).
 * In that case we hide it and show "View full session" instead.
 */
export function isResultJsonBlob(tool: ToolInvocation): boolean {
  if (!tool.result) return false
  if (typeof tool.result === 'object' && tool.result !== null) {
    const r = tool.result as Record<string, unknown>
    // Has human-readable content — show it
    if (typeof r.content === 'string' && r.content.trim().length > 0) return false
    if (typeof r.text === 'string' && r.text.trim().length > 0) return false
    if (typeof r.output === 'string' && r.output.trim().length > 0) return false
    if (typeof r.message === 'string' && r.message.trim().length > 0) return false
    if (typeof r.summary === 'string' && r.summary.trim().length > 0) return false
    // Only sessionId / metadata — treat as JSON blob
    return true
  }
  if (typeof tool.result === 'string') {
    const s = tool.result.trim()
    if ((s.startsWith('{') || s.startsWith('[')) && s.includes('"')) {
      // Try to parse — if it has readable content inside, it's not a blob
      try {
        const parsed = JSON.parse(s) as Record<string, unknown>
        for (const key of ['content', 'text', 'output', 'message', 'summary']) {
          if (typeof parsed[key] === 'string' && parsed[key].trim().length > 0) return false
        }
      } catch {
        // Can't parse — treat as blob
      }
      return true
    }
  }
  return false
}

/**
 * Extract readable text from a result value (object or string).
 * Handles JSON strings that wrap an `output` or similar field.
 */
function extractReadableText(value: unknown): string | null {
  if (!value) return null

  // If it's an object, look for common human-readable keys
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    for (const key of ['content', 'text', 'output', 'message', 'summary']) {
      if (typeof obj[key] === 'string' && obj[key].trim().length > 0) {
        return cleanResultText(obj[key])
      }
    }
    return null
  }

  // If it's a string, try to parse as JSON and extract readable fields
  if (typeof value === 'string') {
    const str = value.trim()
    if (str.startsWith('{') || str.startsWith('[')) {
      try {
        const parsed = JSON.parse(str) as Record<string, unknown>
        const nested = extractReadableText(parsed)
        if (nested) return nested
      } catch {
        // Not valid JSON — fall through to return as-is
      }
    }
    return cleanResultText(str)
  }

  return String(value)
}

/**
 * Clean up result text — handle escaped newlines, strip XML-like wrapper tags
 */
function cleanResultText(text: string): string {
  let cleaned = text
  // Replace literal \n with actual newlines (common in JSON-encoded output)
  if (cleaned.includes('\\n')) {
    cleaned = cleaned.replace(/\\n/g, '\n')
  }
  // Strip common wrapper tags like <task_result>...</task_result>
  cleaned = cleaned.replace(/<\/?task_result>/g, '')
  // Strip leading "task_id: ..." line if present (internal metadata)
  cleaned = cleaned.replace(/^task_id:\s*\S+\s*(\(.*?\))?\s*\n*/m, '')
  return cleaned.trim()
}

/**
 * Get the result text from a subagent tool invocation
 */
export function getSubagentResultText(tool: ToolInvocation): string | null {
  if (!tool.result) return null
  return extractReadableText(tool.result)
}
