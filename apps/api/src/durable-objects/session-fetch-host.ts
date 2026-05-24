import type { Message, Task } from './session-types'

/** Minimal SessionDO surface required by HTTP fetch route handlers. */
export interface SessionFetchHost {
  getWebSocketCount(): number
  getE2bApiKey(): string | undefined
  getMessages(options: { limit?: number; before?: string }): Promise<Message[]>
  persistMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>
  getTasks(options?: { status?: Task['status']; limit?: number }): Promise<Task[]>
  persistTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task>
  getSessionMeta(): Promise<Record<string, string>>
  setSessionMeta(key: string, value: string): Promise<void>
  broadcast(message: object): void
  provisionSandbox(): Promise<unknown>
  getSandboxStatus(): Promise<unknown>
  pauseSandbox(): Promise<void>
  resumeSandbox(): Promise<unknown>
  terminateSandbox(): Promise<void>
  getBranchName(): Promise<string | null>
  getPullRequest(): Promise<{ number: number; url: string; draft: boolean } | null>
  getRepoUrl(): Promise<string | null>
  markReadyForReview(): Promise<void>
  startTask(taskDescription: string): Promise<unknown>
  handleAgentResponse(response: { summary: string; hasChanges: boolean }): Promise<void>
  initializeAgentExecutor(
    sandbox: import('@e2b/code-interpreter').Sandbox,
    githubToken: string,
    gitUser: { name: string; email: string },
  ): Promise<unknown>
  handleWebSocketUpgrade(request: Request): Response
}
