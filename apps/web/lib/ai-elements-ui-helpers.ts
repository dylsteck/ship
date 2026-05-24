import type { UIMessage } from './ai-elements-adapter'

/** Maps ToolInvocation state to the Tool UI component status. */
export function mapToolState(state: string): 'pending' | 'in_progress' | 'completed' | 'failed' {
  switch (state) {
    case 'partial-call':
      return 'pending'
    case 'call':
      return 'in_progress'
    case 'result':
      return 'completed'
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

/** Human-readable status label from the current streaming state. */
export function getStreamingStatus(messages: UIMessage[], streamingMessageId: string | null): string {
  if (!streamingMessageId) return ''

  const msg = messages.find((m) => m.id === streamingMessageId)
  if (!msg) return 'Thinking...'

  const activeTools = msg.toolInvocations?.filter((t) => t.state === 'call' || t.state === 'partial-call')

  if (activeTools && activeTools.length > 0) {
    const latest = activeTools[activeTools.length - 1]
    const name = latest.toolName.toLowerCase()

    if (name.includes('read') || name.includes('glob') || name.includes('grep')) {
      return `Reading: ${latest.title || 'files...'}`
    }
    if (name.includes('write') || name.includes('edit')) {
      return `Writing: ${latest.title || 'code...'}`
    }
    if (name.includes('bash') || name.includes('run') || name.includes('shell')) {
      return `Running: ${latest.title || 'command...'}`
    }
    if (name.includes('task') || name.includes('agent')) {
      return 'Creating task...'
    }
    return `${latest.toolName}: ${latest.title || ''}`
  }

  if (msg.reasoning && msg.reasoning.length > 0) {
    return 'Reasoning...'
  }

  if (msg.content) {
    return 'Writing response...'
  }

  return 'Thinking...'
}
