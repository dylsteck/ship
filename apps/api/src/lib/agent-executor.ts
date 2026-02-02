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

/**
 * Agent executor configuration
 */
export interface AgentExecutorConfig {
  sessionDO: SessionDO
  sandbox: Sandbox
  githubToken: string
  repoUrl: string
  gitUser: GitUser
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
 * Manages agent execution with integrated Git workflow
 */
export class AgentExecutor {
  private sessionDO: SessionDO
  private sandbox: Sandbox
  private githubClient: GitHubClient
  private repoUrl: string
  private gitUser: GitUser
  private sessionId: string
  private repoPath: string = '/home/user/repo'

  constructor(config: AgentExecutorConfig) {
    this.sessionDO = config.sessionDO
    this.sandbox = config.sandbox
    this.githubClient = new GitHubClient(config.githubToken)
    this.repoUrl = config.repoUrl
    this.gitUser = config.gitUser

    // Extract session ID from SessionDO context
    // Note: We'll need to pass this explicitly in the config
    this.sessionId = crypto.randomUUID() // Placeholder - should be passed in config
  }

  /**
   * Execute task with Git workflow setup
   * Creates branch and stores state in SessionDO
   *
   * @param taskDescription - Task description from user
   * @returns Execution context with branch info
   */
  async executeTask(taskDescription: string): Promise<ExecutionContext> {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to setup task execution: ${message}`)
    }
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

    try {
      // Commit changes
      const commitHash = await this.commitChanges(response.summary)

      // Get branch name from SessionDO
      const branchName = await this.sessionDO.getBranchName()
      if (!branchName) {
        throw new Error('No branch name set - call executeTask first')
      }

      // Push to remote
      await pushBranch(
        this.sandbox,
        branchName,
        this.githubClient['octokit'].auth as string, // Access token from client
        this.repoPath,
      )

      console.log(`Committed and pushed: ${commitHash}`)
    } catch (error) {
      // Log error but don't fail agent execution
      console.error('Git workflow error:', error)
      // Error will be visible in chat as system message
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
    try {
      // Commit changes in sandbox
      const commitHash = await commitChanges(
        this.sandbox,
        message,
        this.gitUser,
        this.repoPath,
      )

      // Check if this is the first commit
      const isFirstCommit = await this.sessionDO.markFirstCommit()

      // Auto-create PR on first commit
      if (isFirstCommit) {
        await this.createPullRequest(message)
      }

      return commitHash
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to commit changes: ${message}`)
    }
  }

  /**
   * Create draft pull request
   * Called automatically on first commit
   *
   * @param taskDescription - Task description for PR title/body
   */
  private async createPullRequest(taskDescription: string): Promise<void> {
    try {
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
    } catch (error) {
      // Log error but don't fail - user can create PR manually
      console.error('Failed to create PR:', error)
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
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to mark PR ready: ${message}`)
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
