/** Central React Query keys for `@ship/sdk` hooks. */
export const queryKeys = {
  sessions: ['sessions'] as const,
  session: (sessionId: string) => ['session', sessionId] as const,
  sandbox: (sessionId: string) => ['sandbox', sessionId] as const,
  models: ['models-available'] as const,
  modelsDefault: ['models-default'] as const,
  sessionModel: (sessionId: string) => ['session-model', sessionId] as const,
  agentDefaultModel: (agentId: string) => ['agent-default-model', agentId] as const,
  agentDefaultModels: (agentIds: string[]) => ['agent-default-models', ...agentIds] as const,
  agents: ['models-agents'] as const,
  defaultAgent: ['models-default-agent'] as const,
  connectors: ['connectors'] as const,
  defaultRepo: ['default-repo'] as const,
  githubRepos: (page: number) => ['github-repos', page] as const,
  usersMe: ['users-me'] as const,
  chatMessages: (sessionId: string, limit?: number, before?: string) =>
    ['chat-messages', sessionId, limit, before] as const,
  chatTasks: (sessionId: string) => ['chat-tasks', sessionId] as const,
  gitState: (sessionId: string) => ['git-state', sessionId] as const,
  desktopState: (sessionId: string, retryToken = 0) => ['desktop-state', sessionId, retryToken] as const,
}
