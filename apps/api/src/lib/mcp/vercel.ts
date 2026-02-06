/**
 * Vercel MCP Server
 *
 * Exposes Vercel deployment tools via Model Context Protocol (MCP)
 * for agent access in chat interface.
 *
 * Tools:
 * - vercel_deploy_preview - Deploy preview branch
 * - vercel_deploy_production - Deploy to production
 * - vercel_get_deployment - Get deployment status and logs
 * - vercel_list_deployments - List recent deployments
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

/**
 * Vercel deployment parameters
 */
interface DeployPreviewParams {
  branch: string
  projectId: string
}

interface DeployProductionParams {
  branch: string
  projectId: string
}

interface GetDeploymentParams {
  deploymentId: string
}

interface ListDeploymentsParams {
  projectId: string
  limit?: number
}

/**
 * Get Vercel access token for user
 * This would be called with userId from the request context
 */
async function getVercelToken(userId: string, db: D1Database): Promise<string | null> {
  const account = await db
    .prepare('SELECT access_token FROM accounts WHERE user_id = ? AND provider = ?')
    .bind(userId, 'vercel')
    .first<{ access_token: string }>()

  return account?.access_token || null
}

/**
 * Create Vercel MCP server instance
 * 
 * This MCP server exposes Vercel deployment tools for use by OpenCode agents.
 * Configured in opencode.json as a remote MCP server.
 *
 * @param userId - User ID for token retrieval
 * @param db - D1 database instance
 * @returns MCP server instance
 */
export function createVercelMCPServer(userId: string, db: D1Database): Server {
  const server = new Server(
    {
      name: 'vercel-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'vercel_deploy_preview',
          description: 'Deploy a preview branch to Vercel',
          inputSchema: {
            type: 'object',
            properties: {
              branch: {
                type: 'string',
                description: 'Git branch name to deploy',
              },
              projectId: {
                type: 'string',
                description: 'Vercel project ID',
              },
            },
            required: ['branch', 'projectId'],
          },
        },
        {
          name: 'vercel_deploy_production',
          description: 'Deploy a branch to Vercel production',
          inputSchema: {
            type: 'object',
            properties: {
              branch: {
                type: 'string',
                description: 'Git branch name to deploy',
              },
              projectId: {
                type: 'string',
                description: 'Vercel project ID',
              },
            },
            required: ['branch', 'projectId'],
          },
        },
        {
          name: 'vercel_get_deployment',
          description: 'Get deployment status and logs',
          inputSchema: {
            type: 'object',
            properties: {
              deploymentId: {
                type: 'string',
                description: 'Vercel deployment ID',
              },
            },
            required: ['deploymentId'],
          },
        },
        {
          name: 'vercel_list_deployments',
          description: 'List recent deployments for a project',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Vercel project ID',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of deployments to return',
                default: 10,
              },
            },
            required: ['projectId'],
          },
        },
      ] as Tool[],
    }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      const token = await getVercelToken(userId, db)
      if (!token) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Vercel account not connected. Please connect your Vercel account in settings.',
            },
          ],
          isError: true,
        }
      }

      // Note: @vercel/sdk would be used here for actual API calls
      // For now, return structured responses indicating the tool structure

      switch (name) {
        case 'vercel_deploy_preview': {
          const params = args as DeployPreviewParams
          // TODO: Implement actual Vercel API call
          return {
            content: [
              {
                type: 'text',
                text: `Preview deployment initiated for branch "${params.branch}" in project "${params.projectId}". Note: Full Vercel SDK integration pending.`,
              },
            ],
          }
        }

        case 'vercel_deploy_production': {
          const params = args as DeployProductionParams
          // TODO: Implement actual Vercel API call
          return {
            content: [
              {
                type: 'text',
                text: `Production deployment initiated for branch "${params.branch}" in project "${params.projectId}". Note: Full Vercel SDK integration pending.`,
              },
            ],
          }
        }

        case 'vercel_get_deployment': {
          const params = args as GetDeploymentParams
          // TODO: Implement actual Vercel API call
          return {
            content: [
              {
                type: 'text',
                text: `Deployment status for "${params.deploymentId}". Note: Full Vercel SDK integration pending.`,
              },
            ],
          }
        }

        case 'vercel_list_deployments': {
          const params = args as ListDeploymentsParams
          // TODO: Implement actual Vercel API call
          return {
            content: [
              {
                type: 'text',
                text: `Recent deployments for project "${params.projectId}". Note: Full Vercel SDK integration pending.`,
              },
            ],
          }
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          }
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      }
    }
  })

  return server
}
