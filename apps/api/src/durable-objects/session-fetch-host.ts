import type { Message, Task } from './session-types'
import type { BuildSessionSummaryOptions } from './session-summary'
import type { SessionEventRow, TurnRow } from './session-turn-store'
import type { SessionSummary, Turn, TurnStatus } from '@ship/contracts'

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
  createTurn(sessionId: string, turnId: string): Promise<TurnRow>
  completeTurn(turnId: string, status: TurnStatus, diffSummaryJson?: string): Promise<void>
  getTurns(sessionId: string, limit?: number): Promise<Turn[]>
  appendSessionEvent(type: string, payloadJson: string): Promise<SessionEventRow>
  getRecentSessionEvents(limit?: number): Promise<SessionEventRow[]>
  buildSessionSummary(meta: Record<string, string>, opts?: BuildSessionSummaryOptions): SessionSummary
  broadcastSessionSummary(summary: SessionSummary): void
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
    sandbox: import('../lib/sandbox-command').ComputeCommandSandbox,
    githubToken: string,
    gitUser: { name: string; email: string },
  ): Promise<unknown>
  handleWebSocketUpgrade(request: Request): Response
}
