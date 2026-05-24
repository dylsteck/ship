import type { AgentStatus } from '@/components/session/status-indicator'

export function handleSessionWebSocketMessage(
  data: Record<string, unknown>,
  setters: {
    setAgentStatus: (s: AgentStatus) => void
    setCurrentTool: (t: string | undefined) => void
    setSandboxId: (id: string | null) => void
    setSandboxStatus: (s: 'provisioning' | 'ready' | 'error' | 'none') => void
    setSandboxProgress: (p: string | null) => void
    setOpencodeUrl: (url: string | null) => void
    setOpencodeSessionId: (id: string | null) => void
    setSessionTitle: (title: string | undefined) => void
  },
  sandboxStatusRef: React.MutableRefObject<'provisioning' | 'ready' | 'error' | 'none'>,
): void {
  if (data.type === 'agent-status') {
    setters.setAgentStatus(data.status as AgentStatus)
    setters.setCurrentTool(data.details as string | undefined)
    return
  }

  if (data.type === 'sandbox-status') {
    if (data.sandboxId) setters.setSandboxId(data.sandboxId as string)
    if (data.status === 'ready') {
      setters.setSandboxStatus('ready')
      setters.setSandboxProgress(null)
    } else if (data.status === 'error') {
      setters.setSandboxStatus('error')
      setters.setSandboxProgress(null)
    }
    return
  }

  if (data.type === 'sandbox-cloning') {
    setters.setSandboxProgress(`Cloning ${data.repoOwner}/${data.repoName}...`)
    return
  }

  if (data.type === 'sandbox-ready') {
    setters.setSandboxStatus('ready')
    setters.setSandboxProgress(`Repository cloned. Branch: ${data.branchName}`)
    setTimeout(() => setters.setSandboxProgress(null), 3000)
    return
  }

  if (data.type === 'opencode-started' || data.type === 'opencode-url') {
    setters.setSandboxProgress('OpenCode server started')
    const url = (data.url || data.opencodeUrl || data.serverUrl) as string | undefined
    if (url && typeof url === 'string' && url.trim()) {
      setters.setOpencodeUrl(url.trim())
      if (sandboxStatusRef.current !== 'ready') setters.setSandboxStatus('ready')
    }
    setTimeout(() => setters.setSandboxProgress(null), 2000)
    return
  }

  if (data.type === 'opencode-session-created') {
    if (data.sessionId && typeof data.sessionId === 'string') {
      setters.setOpencodeSessionId(data.sessionId)
    }
    return
  }

  if (data.type !== 'opencode-event') return

  const ocEvent = data.event as Record<string, unknown> | undefined
  if (!ocEvent) return

  const payload = ocEvent.payload as { type?: string } | undefined
  if (payload?.type === 'server.connected') {
    setters.setSandboxProgress('Connected to agent')
    setTimeout(() => setters.setSandboxProgress(null), 2000)
    return
  }

  if (ocEvent.type === 'session.updated') {
    const info = (ocEvent.properties as { info?: { title?: string } } | undefined)?.info
    if (info?.title && !info.title.startsWith('New session')) {
      setters.setSessionTitle(info.title)
    }
    return
  }

  if (ocEvent.type === 'message.part.updated') {
    const part = (ocEvent.properties as { part?: Record<string, unknown> } | undefined)?.part
    if (part?.type === 'tool') {
      applyToolPartUpdate(part, setters)
    } else if (part?.type === 'text') {
      setters.setAgentStatus('coding')
      setters.setCurrentTool('Writing response')
    }
    return
  }

  if (ocEvent.type === 'session.idle') {
    setters.setAgentStatus('idle')
    setters.setCurrentTool(undefined)
    setters.setSandboxProgress(null)
  }
}

function applyToolPartUpdate(
  part: Record<string, unknown>,
  setters: {
    setAgentStatus: (s: AgentStatus) => void
    setCurrentTool: (t: string | undefined) => void
    setSandboxProgress: (p: string | null) => void
  },
): void {
  const toolName = typeof part.tool === 'string' ? part.tool : (part.tool as { name?: string } | undefined)?.name
  const state = part.state as { title?: string; status?: string } | undefined
  const toolTitle = state?.title || ''
  const toolStatus = state?.status

  if (!toolName) return

  const name = toolName.toLowerCase()
  let statusLabel = toolTitle || toolName

  if (name.includes('read') || name.includes('glob') || name.includes('grep')) {
    statusLabel = `Reading: ${toolTitle.slice(0, 30) || 'files'}`
    setters.setAgentStatus('planning')
  } else if (name.includes('write') || name.includes('edit')) {
    statusLabel = `Writing: ${toolTitle.slice(0, 30) || 'code'}`
    setters.setAgentStatus('coding')
  } else if (name.includes('bash') || name.includes('run') || name.includes('shell')) {
    statusLabel = `Running: ${toolTitle.slice(0, 30) || 'command'}`
    setters.setAgentStatus('executing')
  } else if (name.includes('task') || name.includes('agent')) {
    statusLabel = toolTitle || 'Running task'
    setters.setAgentStatus('planning')
  } else if (name.includes('search') || name.includes('semantic')) {
    statusLabel = `Searching: ${toolTitle.slice(0, 30) || ''}`
    setters.setAgentStatus('planning')
  }

  setters.setCurrentTool(statusLabel)
  setters.setSandboxProgress(statusLabel)
  if (toolStatus === 'complete') {
    setTimeout(() => setters.setSandboxProgress(null), 1000)
  }
}
