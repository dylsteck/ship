/**
 * Linear API wrapper using GraphQL
 *
 * Provides authenticated Linear operations:
 * - Get issues (assigned, by team, etc.)
 * - Create issues
 * - Update issue status
 * - Link issues to sessions
 *
 * Pattern: All operations use user's Linear access token
 * Security: Tokens retrieved from accounts table per request
 */

import { GraphQLClient } from 'graphql-request'

/**
 * Linear API error types
 */
export class LinearError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message)
    this.name = 'LinearError'
  }
}

/**
 * Linear issue type
 */
export interface LinearIssue {
  id: string
  identifier: string // e.g., "ENG-123"
  title: string
  description?: string
  state: {
    id: string
    name: string
    type: string
  }
  team: {
    id: string
    key: string
    name: string
  }
  url: string
  createdAt: string
  updatedAt: string
}

/**
 * Linear issue state type
 */
export interface LinearIssueState {
  id: string
  name: string
  type: string
}

/**
 * Parameters for creating a Linear issue
 */
export interface CreateLinearIssueParams {
  title: string
  description?: string
  teamId: string
  stateId?: string
}

/**
 * Parameters for updating a Linear issue
 */
export interface UpdateLinearIssueParams {
  issueId: string
  title?: string
  description?: string
  stateId?: string
}

/**
 * LinearClient class
 * Wraps GraphQL client with Linear API authentication
 *
 * Usage:
 *   const client = new LinearClient(accessToken)
 *   await client.getIssues()
 */
export class LinearClient {
  private client: GraphQLClient
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.client = new GraphQLClient('https://api.linear.app/graphql', {
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Get user's assigned issues
   *
   * @param limit - Maximum number of issues to return (default: 50)
   * @returns Array of Linear issues
   */
  async getIssues(limit = 50): Promise<LinearIssue[]> {
    const query = `
      query GetAssignedIssues($limit: Int!) {
        assignedIssues(first: $limit) {
          nodes {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            team {
              id
              key
              name
            }
            url
            createdAt
            updatedAt
          }
        }
      }
    `

    try {
      const data = await this.client.request<{
        assignedIssues: { nodes: LinearIssue[] }
      }>(query, { limit })

      return data.assignedIssues.nodes
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new LinearError(`Failed to fetch Linear issues: ${message}`, 'ISSUES_FETCH_FAILED')
    }
  }

  /**
   * Get specific issue by ID
   *
   * @param issueId - Linear issue ID
   * @returns Linear issue or null if not found
   */
  async getIssue(issueId: string): Promise<LinearIssue | null> {
    const query = `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          state {
            id
            name
            type
          }
          team {
            id
            key
            name
          }
          url
          createdAt
          updatedAt
        }
      }
    `

    try {
      const data = await this.client.request<{ issue: LinearIssue | null }>(query, {
        id: issueId,
      })

      return data.issue
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new LinearError(`Failed to fetch Linear issue: ${message}`, 'ISSUE_FETCH_FAILED')
    }
  }

  /**
   * Create a new Linear issue
   *
   * @param params - Issue creation parameters
   * @returns Created Linear issue
   */
  async createIssue(params: CreateLinearIssueParams): Promise<LinearIssue> {
    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            team {
              id
              key
              name
            }
            url
            createdAt
            updatedAt
          }
        }
      }
    `

    try {
      const data = await this.client.request<{
        issueCreate: { success: boolean; issue: LinearIssue }
      }>(mutation, {
        input: {
          title: params.title,
          description: params.description || '',
          teamId: params.teamId,
          stateId: params.stateId,
        },
      })

      if (!data.issueCreate.success || !data.issueCreate.issue) {
        throw new LinearError('Failed to create Linear issue', 'ISSUE_CREATE_FAILED')
      }

      return data.issueCreate.issue
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new LinearError(`Failed to create Linear issue: ${message}`, 'ISSUE_CREATE_FAILED')
    }
  }

  /**
   * Update Linear issue status or properties
   *
   * @param params - Issue update parameters
   * @returns Updated Linear issue
   */
  async updateIssue(params: UpdateLinearIssueParams): Promise<LinearIssue> {
    const mutation = `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            team {
              id
              key
              name
            }
            url
            createdAt
            updatedAt
          }
        }
      }
    `

    const input: Record<string, unknown> = {}
    if (params.title !== undefined) input.title = params.title
    if (params.description !== undefined) input.description = params.description
    if (params.stateId !== undefined) input.stateId = params.stateId

    try {
      const data = await this.client.request<{
        issueUpdate: { success: boolean; issue: LinearIssue }
      }>(mutation, {
        id: params.issueId,
        input,
      })

      if (!data.issueUpdate.success || !data.issueUpdate.issue) {
        throw new LinearError('Failed to update Linear issue', 'ISSUE_UPDATE_FAILED')
      }

      return data.issueUpdate.issue
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new LinearError(`Failed to update Linear issue: ${message}`, 'ISSUE_UPDATE_FAILED')
    }
  }

  /**
   * Update Linear issue status by state name
   * Helper method that finds state ID from state name
   *
   * @param issueId - Linear issue ID
   * @param stateName - Target state name (e.g., "Done", "In Progress", "Canceled")
   * @returns Updated Linear issue
   */
  async updateIssueStatus(issueId: string, stateName: string): Promise<LinearIssue> {
    // First get the issue to find its team
    const issue = await this.getIssue(issueId)
    if (!issue) {
      throw new LinearError('Issue not found', 'ISSUE_NOT_FOUND', 404)
    }

    // Get team's workflow states
    const query = `
      query GetTeamStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `

    const teamData = await this.client.request<{
      team: { states: { nodes: LinearIssueState[] } }
    }>(query, { teamId: issue.team.id })

    // Find state by name
    const targetState = teamData.team.states.nodes.find(
      (state) => state.name.toLowerCase() === stateName.toLowerCase(),
    )

    if (!targetState) {
      throw new LinearError(`State "${stateName}" not found for team`, 'STATE_NOT_FOUND')
    }

    // Update issue with state ID
    return this.updateIssue({ issueId, stateId: targetState.id })
  }

  /**
   * Add comment to Linear issue
   *
   * @param issueId - Linear issue ID
   * @param body - Comment body
   */
  async addComment(issueId: string, body: string): Promise<void> {
    const mutation = `
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
        }
      }
    `

    try {
      const data = await this.client.request<{ commentCreate: { success: boolean } }>(
        mutation,
        {
          input: {
            issueId,
            body,
          },
        },
      )

      if (!data.commentCreate.success) {
        throw new LinearError('Failed to create comment', 'COMMENT_CREATE_FAILED')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new LinearError(`Failed to add comment: ${message}`, 'COMMENT_CREATE_FAILED')
    }
  }
}

/**
 * Create a Linear client with access token
 * Factory function for consistency with other lib modules
 *
 * @param token - User's Linear access token
 * @returns LinearClient instance
 */
export function createLinearClient(token: string): LinearClient {
  return new LinearClient(token)
}

/**
 * Link Linear issue to session
 * Verifies issue exists and user has access before linking
 *
 * @param accessToken - User's Linear access token
 * @param sessionDO - SessionDO instance
 * @param linearIssueId - Linear issue ID to link
 * @returns Success status
 */
export async function linkLinearIssueToSession(
  accessToken: string,
  sessionDO: { linkLinearIssue: (id: string) => Promise<void> },
  linearIssueId: string,
): Promise<void> {
  const client = createLinearClient(accessToken)

  // Verify issue exists and user has access
  const issue = await client.getIssue(linearIssueId)
  if (!issue) {
    throw new LinearError('Linear issue not found or access denied', 'ISSUE_NOT_FOUND', 404)
  }

  // Link issue to session
  await sessionDO.linkLinearIssue(linearIssueId)
}

/**
 * Get linked Linear issue for session
 *
 * @param sessionDO - SessionDO instance
 * @returns Linear issue ID or null if not linked
 */
export async function getLinkedLinearIssue(sessionDO: {
  getLinearIssueId: () => Promise<string | null>
}): Promise<string | null> {
  return sessionDO.getLinearIssueId()
}

/**
 * Sync Linear issues to create tasks (OPTIONAL - user-initiated only)
 * Creates tasks in SessionDO for each assigned Linear issue
 *
 * @param accessToken - User's Linear access token
 * @param sessionDO - SessionDO instance
 * @returns Count of issues synced
 */
export async function syncIssuesToSession(
  accessToken: string,
  sessionDO: {
    persistTask: (task: { title: string; description?: string; mode: 'build' | 'plan' }) => Promise<unknown>
  },
): Promise<number> {
  const client = createLinearClient(accessToken)

  // Get user's assigned issues
  const issues = await client.getIssues(50) // Limit to 50 issues

  // Create tasks for each issue
  let syncedCount = 0
  for (const issue of issues) {
    await sessionDO.persistTask({
      title: `${issue.identifier}: ${issue.title}`,
      description: issue.description || undefined,
      mode: 'build', // Default to build mode
    })
    syncedCount++
  }

  return syncedCount
}
