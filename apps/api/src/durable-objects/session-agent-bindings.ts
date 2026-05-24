import type { Sandbox } from '@e2b/code-interpreter'
import { createAgentExecutor, type AgentExecutor, type ErrorEvent } from '../lib/agent-executor'
import { getRepoUrl } from './session-git-meta-store'
import type { SessionDO } from './session'

/** Initialize the legacy in-VM agent executor bound to a Session DO instance. */
export async function initializeAgentExecutor(
  host: SessionDO,
  sandbox: Sandbox,
  githubToken: string,
  gitUser: { name: string; email: string },
): Promise<AgentExecutor> {
  const repoUrl = await getRepoUrl(host)
  if (!repoUrl) {
    throw new Error('Repository URL not set')
  }

  return createAgentExecutor({
    sessionDO: host,
    sandbox,
    githubToken,
    repoUrl,
    gitUser,
    sessionId: host.getDoInstanceId(),
    onError: (event: ErrorEvent) => {
      host.broadcast({
        type: 'error',
        message: event.error.message,
        category: event.category,
        context: event.context,
        retryable: event.retryable,
        attempt: event.attempt,
      })
    },
    onStatus: (status: string, details?: string) => {
      host.broadcast({ type: 'agent-status', status, details })
    },
  })
}
