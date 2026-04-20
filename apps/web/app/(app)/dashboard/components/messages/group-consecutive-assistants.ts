import type { UIMessage } from '@/lib/ai-elements-adapter'

export type MessageGroup =
  | { type: 'single'; message: UIMessage }
  | { type: 'assistant-run'; messages: UIMessage[] }

/** Collapse consecutive assistant bubbles into one visual run */
export function groupConsecutiveAssistants(messages: UIMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let run: UIMessage[] = []

  const flushRun = () => {
    if (run.length > 0) {
      groups.push({ type: 'assistant-run', messages: [...run] })
      run = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'assistant' && !msg.type) {
      run.push(msg)
    } else {
      flushRun()
      groups.push({ type: 'single', message: msg })
    }
  }
  flushRun()
  return groups
}
