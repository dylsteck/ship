/**
 * Agent executor with integrated Git workflow
 *
 * Orchestrates agent execution with automatic Git operations:
 * - Create branch on task start
 * - Commit changes after each agent response
 * - Auto-create draft PR on first commit
 * - Push to remote with user attribution
 *
 * Pattern: Bridges OpenCode SDK events with Git workflow automation
 */

import type { Sandbox } from '@e2b/code-interpreter'
import type { SessionDO } from '../durable-objects/session'
import {
  generateBranchName,
  createBranch,
  commitChanges,
  pushBranch,
  type GitUser,
} from './git-workflow'
import {
  GitHubClient,
  parseRepoUrl,
  type CreatePullRequestParams,
} from './github'
import {
  executeWithRetry,
  classifyError,
  sanitizeError,
  ErrorCategory,
  type ErrorDetails,
} from './error-handler'

/**
 * Error event callback
 */
export interface ErrorEvent {
  error: Error
  category: ErrorCategory
  context: string
  retryable: boolean
  attempt: number
}

/**
 * Agent executor configuration
 */
export interface AgentExecutorConfig {
  sessionDO: SessionDO
  sandbox: Sandbox
  githubToken: string
  repoUrl: string
  gitUser: GitUser
  sessionId?: string
  onError?: (event: ErrorEvent) => void
  onStatus?: (status: string, details?: string) => void
}

/**
 * Agent execution context returned after setup
 */
export interface ExecutionContext {
  branchName: string
  repoPath: string
  sessionId: string
}

/**
 * Agent response summary for commit messages
 */
export interface AgentResponse {
  summary: string
  hasChanges: boolean
}

/**
 * AgentExecutor class
 * Manages agent execution with integrated Git workflow and error handling
 */
export class AgentExecutor {
  private sessionDO: SessionDO
  private sandbox: Sandbox
  private githubClient: GitHubClient
  private repoUrl: string
  private gitUser: GitUser
  private sessionId: string
  private repoPath: string = '/home/user/repo'
  private onError?: (event: ErrorEvent) => void
  private onStatus?: (status: string, details?: string) => void
  private isPaused: boolean = false

  constructor(config: AgentExecutorConfig) {
    this.sessionDO = config.sessionDO
    this.sandbox = config.sandbox
    this.githubClient = new GitHubClient(config.githubToken)
    this.repoUrl = config.repoUrl
    this.gitUser = config.gitUser
    this.onError = config.onError
    this.onStatus = config.onStatus

    // Use provided session ID or generate one
    this.sessionId = config.sessionId || crypto.randomUUID()
  }

  /**
   * Pause agent execution
   * Called when persistent error occurs
   */
  pause(): void {
    this.isPaused = true
  }

  /**
   * Resume agent execution
   * Called after user addresses persistent error
   */
  resume(): void {
    this.isPaused = false
  }

  /**
   * Check if agent is paused
   */
  get paused(): boolean {
    return this.isPaused
  }

  /**
   * Execute task with Git workflow setup
   * Creates branch and stores state in SessionDO
   *
   * @param taskDescription - Task description from user
   * @returns Execution context with branch info
   */
  async executeTask(taskDescription: string): Promise<ExecutionContext> {
    return executeWithRetry(
      async () => {
        // Generate branch name from task + session
        const branchName = generateBranchName(taskDescription, this.sessionId)

        // Create branch in sandbox
        await createBranch(this.sandbox, branchName, this.repoPath)

        // Store branch name in SessionDO
        await this.sessionDO.setBranchName(branchName)

        // Store repo URL in SessionDO
        await this.sessionDO.setRepoUrl(this.repoUrl)

        return {
          branchName,
          repoPath: this.repoPath,
          sessionId: this.sessionId,
        }
      },
      {
        operationName: 'Create branch',
        onError: (error, attempt) => {
          const details = classifyError(error)
          this.emitError(error, details.category, 'Create branch', attempt)

          // Pause on persistent errors
          if (details.category === ErrorCategory.Persistent || details.category === ErrorCategory.Fatal) {
            this.pause()
          }
        },
        onRetry: (attempt, delay) => {
          console.log(`Retrying branch creation (attempt ${attempt}, delay ${delay}ms)`)
        },
      },
    )
  }

  /**
   * Handle agent response with Git workflow
   * Commits changes, pushes, and creates PR if first commit
   *
   * @param response - Agent response with summary
   */
  async onAgentResponse(response: AgentResponse): Promise<void> {
    // Skip if no changes
    if (!response.hasChanges) {
      return
    }

    // Skip if paused
    if (this.isPaused) {
      console.log('Agent paused, skipping git workflow')
      return
    }

    try {
      // Commit changes with retry
      const commitHash = await this.commitChanges(response.summary)

      // Get branch name from SessionDO
      const branchName = await this.sessionDO.getBranchName()
      if (!branchName) {
        throw new Error('No branch name set - call executeTask first')
      }

      // Push to remote with retry
      await this.pushWithRetry(branchName)

      console.log(`Committed and pushed: ${commitHash}`)
    } catch (error) {
      // Log error but don't fail agent execution
      const sanitized = sanitizeError(error)
      console.error('Git workflow error:', sanitized)

      const details = classifyError(error)
      const err = error instanceof Error ? error : new Error(String(error))
      this.emitError(err, details.category, 'Git workflow', 0)

      // Pause on persistent errors
      if (details.category === ErrorCategory.Persistent || details.category === ErrorCategory.Fatal) {
        this.pause()
      }
    }
  }

  /**
   * Commit changes with user attribution
   * Checks if first commit and creates PR if needed
   *
   * @param message - Commit message
   * @returns Commit hash
   */
  async commitChanges(message: string): Promise<string> {
    return executeWithRetry(
      async () => {
        // Commit changes in sandbox
        const commitHash = await commitChanges(this.sandbox, message, this.gitUser, this.repoPath)

        // Check if this is the first commit
        const isFirstCommit = await this.sessionDO.markFirstCommit()

        // Auto-create PR on first commit
        if (isFirstCommit) {
          await this.createPullRequest(message)
        }

        return commitHash
      },
      {
        operationName: 'Commit changes',
        onError: (error, attempt) => {
          const details = classifyError(error)
          this.emitError(error, details.category, 'Commit changes', attempt)

          // Pause on persistent errors
          if (details.category === ErrorCategory.Persistent || details.category === ErrorCategory.Fatal) {
            this.pause()
          }
        },
        onRetry: (attempt, delay) => {
          console.log(`Retrying commit (attempt ${attempt}, delay ${delay}ms)`)
        },
      },
    )
  }

  /**
   * Push branch with retry logic
   *
   * @param branchName - Branch name to push
   */
  private async pushWithRetry(branchName: string): Promise<void> {
    return executeWithRetry(
      async () => {
        // Get token from github client
        const token = await this.githubClient['octokit'].auth()
        const tokenString = typeof token === 'string' ? token : (token as { token: string }).token

        await pushBranch(this.sandbox, branchName, tokenString, this.repoPath)
      },
      {
        operationName: 'Push to remote',
        onError: (error, attempt) => {
          const details = classifyError(error)
          this.emitError(error, details.category, 'Push to remote', attempt)

          // Pause on persistent errors (e.g., permission denied)
          if (details.category === ErrorCategory.Persistent || details.category === ErrorCategory.Fatal) {
            this.pause()
          }
        },
        onRetry: (attempt, delay) => {
          console.log(`Retrying push (attempt ${attempt}, delay ${delay}ms)`)
        },
      },
    )
  }

  /**
   * Create draft pull request
   * Called automatically on first commit
   *
   * @param taskDescription - Task description for PR title/body
   */
  private async createPullRequest(taskDescription: string): Promise<void> {
    try {
      await executeWithRetry(
        async () => {
          // Get branch name from SessionDO
          const branchName = await this.sessionDO.getBranchName()
          if (!branchName) {
            throw new Error('No branch name set')
          }

          // Parse repo owner/name from URL
          const { owner, repo } = parseRepoUrl(this.repoUrl)

          // Create PR description
          const prBody = this.generatePRDescription(taskDescription, branchName)

          // Create pull request
          const pr = await this.githubClient.createPullRequest({
            owner,
            repo,
            title: taskDescription,
            body: prBody,
            head: branchName,
            base: 'main',
            draft: true, // Always draft by default per CONTEXT.md
          })

          // Store PR info in SessionDO
          await this.sessionDO.setPullRequest(pr.number, pr.htmlUrl, pr.draft)

          console.log(`Created draft PR #${pr.number}: ${pr.htmlUrl}`)
        },
        {
          operationName: 'Create PR',
          onError: (error, attempt) => {
            const details = classifyError(error)
            this.emitError(error, details.category, 'Create PR', attempt)
          },
          onRetry: (attempt, delay) => {
            console.log(`Retrying PR creation (attempt ${attempt}, delay ${delay}ms)`)
          },
        },
      )
    } catch (error) {
      // Log error but don't fail - user can create PR manually
      const sanitized = sanitizeError(error)
      console.error('Failed to create PR:', sanitized)
    }
  }

  /**
   * Generate PR description template
   *
   * @param taskDescription - Task description
   * @param branchName - Branch name
   * @returns Formatted PR body
   */
  private generatePRDescription(taskDescription: string, branchName: string): string {
    return `Automated PR from Ship session

Task: ${taskDescription}
Branch: ${branchName}

This PR was created automatically by the Ship agent.`
  }

  /**
   * Mark PR as ready for review
   * Called when user clicks "Mark Ready for Review"
   */
  async markPRReady(): Promise<void> {
    return executeWithRetry(
      async () => {
        // Get PR info from SessionDO
        const pr = await this.sessionDO.getPullRequest()
        if (!pr) {
          throw new Error('No PR to mark ready')
        }

        // Parse repo owner/name
        const { owner, repo } = parseRepoUrl(this.repoUrl)

        // Update PR to ready (draft: false)
        await this.githubClient.markReadyForReview(pr.number, owner, repo)

        // Update SessionDO state
        await this.sessionDO.markReadyForReview()

        console.log(`Marked PR #${pr.number} as ready for review`)
      },
      {
        operationName: 'Mark PR ready',
        onError: (error, attempt) => {
          const details = classifyError(error)
          this.emitError(error, details.category, 'Mark PR ready', attempt)

          // Pause on persistent errors
          if (details.category === ErrorCategory.Persistent || details.category === ErrorCategory.Fatal) {
            this.pause()
          }
        },
        onRetry: (attempt, delay) => {
          console.log(`Retrying mark PR ready (attempt ${attempt}, delay ${delay}ms)`)
        },
      },
    )
  }

  /**
   * Emit error event to session
   * Sanitizes error message and includes context
   *
   * @param error - Error object
   * @param category - Error category
   * @param context - Operation context
   * @param attempt - Retry attempt number
   */
  private emitError(error: Error, category: ErrorCategory, context: string, attempt: number): void {
    if (this.onError) {
      const details = classifyError(error)

      this.onError({
        error: new Error(sanitizeError(error)), // Sanitize before emitting
        category,
        context,
        retryable: details.retryable,
        attempt,
      })
    }
  }

  /**
   * Emit status update to session
   * Used to notify clients of agent state changes
   *
   * @param status - Status message
   * @param details - Optional details
   */
  emitStatus(status: string, details?: string): void {
    if (this.onStatus) {
      this.onStatus(status, details)
    }
  }
}

/**
 * Factory function to create AgentExecutor
 * Convenience wrapper for consistent API
 *
 * @param config - Executor configuration
 * @returns AgentExecutor instance
 */
export function createAgentExecutor(config: AgentExecutorConfig): AgentExecutor {
  return new AgentExecutor(config)
}
