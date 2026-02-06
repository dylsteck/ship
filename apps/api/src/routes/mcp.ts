/**
 * MCP (Model Context Protocol) routes
 *
 * Provides HTTP endpoints for MCP server access.
 * OpenCode supports remote MCP servers via HTTP - configure in opencode.json.
 * 
 * The Vercel MCP server is configured in opencode.json and automatically
 * available to OpenCode agents when enabled.
 */

import { Hono } from 'hono'
import { createVercelMCPServer } from '../lib/mcp/vercel'
import type { Env } from '../env.d'

const mcp = new Hono<{ Bindings: Env }>()

/**
 * POST /mcp/vercel
 * MCP protocol endpoint for Vercel tools
 * 
 * Accepts userId via:
 * - Header: X-User-Id (for OpenCode MCP integration)
 * - Header: X-Session-Id (to look up userId from session metadata)
 * - Body: { userId, method, params } (for direct API calls)
 *
 * Note: OpenCode supports remote MCP servers via HTTP. This endpoint
 * implements the MCP protocol over HTTP for Vercel deployment tools.
 * 
 * TODO: Enhance userId extraction - OpenCode MCP requests don't automatically
 * include userId. Options:
 * 1. Extract from OpenCode session metadata (if session ID available)
 * 2. Use token-based auth where token encodes userId
 * 3. Configure per-user MCP endpoints
 */
mcp.post('/vercel', async (c) => {
  try {
    // Get userId from header (OpenCode MCP) or body (direct API calls)
    const userIdFromHeader = c.req.header('X-User-Id')
    const sessionIdFromHeader = c.req.header('X-Session-Id')
    const body = await c.req.json<{
      userId?: string
      method?: string
      params?: unknown
    }>().catch(() => ({})) // Allow empty body for MCP protocol requests

    let userId = userIdFromHeader || body.userId

    // If we have a session ID but no userId, try to look it up from session metadata
    if (!userId && sessionIdFromHeader) {
      // TODO: Look up userId from SessionDO metadata
      // For now, this is a placeholder - we'd need to access SessionDO
      // const doId = c.env.SESSION_DO.idFromName(sessionIdFromHeader)
      // const stub = c.env.SESSION_DO.get(doId)
      // const meta = await stub.fetch('http://do/meta')
      // userId = meta.userId
    }

    if (!userId) {
      return c.json({ error: 'userId is required (via X-User-Id header, X-Session-Id header, or body)' }, 400)
    }

    // For MCP protocol, method comes from JSON-RPC request body
    // For direct API calls, method comes from body.method
    const method = body.method || 'tools/list' // Default to list tools if not specified

    // Create MCP server instance
    const server = createVercelMCPServer(userId, c.env.DB)

    // Handle MCP protocol requests
    // OpenCode sends JSON-RPC requests, so we need to parse the body as JSON-RPC
    // If body is a JSON-RPC request, use it directly; otherwise use method/params from body
    
    let jsonRpcRequest: { jsonrpc: string; id: number; method: string; params?: unknown }
    
    // Check if body is already a JSON-RPC request (from OpenCode MCP)
    if (body.jsonrpc && body.method) {
      jsonRpcRequest = body as { jsonrpc: string; id: number; method: string; params?: unknown }
    } else {
      // Legacy format: construct JSON-RPC request from method/params
      jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method,
        params: body.params,
      }
    }

    if (jsonRpcRequest.method === 'tools/list') {
      const response = await server.request(
        {
          jsonrpc: '2.0',
          id: jsonRpcRequest.id || 1,
          method: 'tools/list',
        },
        {},
      )
      return c.json(response)
    } else if (jsonRpcRequest.method === 'tools/call') {
      if (!jsonRpcRequest.params || typeof jsonRpcRequest.params !== 'object') {
        return c.json({ error: 'params required for tools/call' }, 400)
      }

      const response = await server.request(
        {
          jsonrpc: '2.0',
          id: jsonRpcRequest.id || 1,
          method: 'tools/call',
          params: jsonRpcRequest.params as { name: string; arguments?: unknown },
        },
        {},
      )
      return c.json(response)
    } else {
      return c.json({ error: `Unknown method: ${jsonRpcRequest.method}` }, 400)
    }
  } catch (error) {
    console.error('Error handling MCP request:', error)
    return c.json(
      {
        error: 'Failed to handle MCP request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

export default mcp
