# Vercel MCP Server Setup for OpenCode

## Overview

OpenCode **does support MCP servers**! We've configured the Vercel MCP server to work with OpenCode agents.

## Current Setup

### 1. MCP Endpoint (`apps/api/src/routes/mcp.ts`)
- HTTP endpoint at `/mcp/vercel` that implements MCP protocol
- Accepts userId via:
  - `X-User-Id` header (for OpenCode MCP integration)
  - `X-Session-Id` header (to look up userId from session - TODO)
  - Body `{ userId }` (for direct API calls)

### 2. OpenCode Config (`opencode.json`)
- Configured Vercel MCP server as a remote server
- Points to `http://localhost:8787/mcp/vercel`
- Enabled by default

### 3. MCP Server Implementation (`apps/api/src/lib/mcp/vercel.ts`)
- Implements MCP protocol using `@modelcontextprotocol/sdk`
- Exposes Vercel deployment tools:
  - `vercel_deploy_preview`
  - `vercel_deploy_production`
  - `vercel_get_deployment`
  - `vercel_list_deployments`

## How It Works

1. OpenCode reads `opencode.json` config file
2. Loads the Vercel MCP server as a remote server
3. Makes HTTP requests to `/mcp/vercel` endpoint
4. MCP endpoint handles JSON-RPC protocol requests
5. Tools are automatically available to OpenCode agents

## Current Limitation: userId Authentication

**Challenge:** OpenCode MCP servers are configured globally, but we need per-user authentication. OpenCode doesn't automatically pass session context (like userId) to MCP servers.

**Current Solutions:**
1. ✅ Accept userId via `X-User-Id` header (if OpenCode supports custom headers)
2. ✅ Accept userId via `X-Session-Id` header and look up from SessionDO (TODO: implement lookup)
3. ⚠️ Direct API calls can pass userId in body

**Future Enhancements:**
1. Extract userId from OpenCode session metadata (if OpenCode provides session context)
2. Use token-based authentication where token encodes userId
3. Create per-user MCP endpoints: `/mcp/vercel/:userId`
4. Store userId in OpenCode session metadata when creating sessions

## Testing

To test the MCP integration:

1. Ensure OpenCode server is running (auto-starts in dev mode)
2. OpenCode will load `opencode.json` automatically
3. Vercel MCP tools should be available to agents
4. Test by asking agent: "Deploy this branch to Vercel preview"

## Production Considerations

For production:
1. Update `opencode.json` URL to production API URL
2. Ensure MCP endpoint is accessible from OpenCode server
3. Implement userId extraction from session context
4. Consider authentication/authorization for MCP endpoint

## References

- [OpenCode MCP Documentation](https://opencode.ai/docs/mcp-servers/)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
