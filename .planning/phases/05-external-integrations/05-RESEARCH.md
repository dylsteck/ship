# Phase 5: External Integrations - Research

**Researched:** 2026-02-01  
**Domain:** Linear API, Vercel API, MCP (Model Context Protocol), GitHub webhooks, connector management
**Confidence:** HIGH

## Summary

Phase 5 adds external integrations for Linear (task management), Vercel (deployments), and GitHub (webhooks/PR linking). The codebase already has GitHub OAuth and API integration via Octokit. This phase adds Linear GraphQL API integration, Vercel MCP server for chat-based deployments, webhook handlers for real-time sync, and a connector management system for enabling/disabling integrations.

**Primary recommendation:** Use Linear GraphQL SDK for issue sync, Vercel SDK for deployments, MCP server pattern for Vercel tools in chat, webhook signature verification for security, and user preferences table for connector enable/disable state.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@linear/sdk` | latest | Linear GraphQL API client | Official SDK with TypeScript types |
| `@vercel/sdk` | latest | Vercel API client | Official SDK for deployments |
| `@modelcontextprotocol/sdk` | latest | MCP server framework | Standard protocol for agent tools |
| `@octokit/rest` | 22.0.1 | GitHub API (already in use) | Already integrated, extend for webhooks |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@octokit/webhooks` | latest | GitHub webhook verification | Verify webhook signatures |
| `graphql-request` | latest | GraphQL client (if Linear SDK insufficient) | Fallback for custom queries |

## Architecture Patterns

### Pattern 1: Linear Issue Sync

**What:** Automatically sync Linear issues to session tasks
**When to use:** When user connects Linear account, poll for assigned issues
**Example:**
```typescript
// Linear GraphQL query for user's assigned issues
const query = `
  query {
    assignedIssues {
      nodes {
        id
        title
        description
        state { name }
        team { key }
      }
    }
  }
`
```

### Pattern 2: Vercel MCP Server

**What:** Expose Vercel deployment tools via MCP for agent access
**When to use:** Agent needs to deploy previews or trigger builds
**Example:**
```typescript
// MCP server with Vercel tools
mcpServer.addTool({
  name: 'vercel_deploy_preview',
  description: 'Deploy preview branch',
  inputSchema: {
    branch: { type: 'string' },
    projectId: { type: 'string' }
  }
})
```

### Pattern 3: Webhook Verification

**What:** Verify webhook signatures from GitHub/Linear
**When to use:** All incoming webhook handlers
**Example:**
```typescript
// Verify GitHub webhook signature
import { verify } from '@octokit/webhooks'
const isValid = await verify(secret, payload, signature)
```

### Pattern 4: Connector Management

**What:** Enable/disable integrations per user
**When to use:** Settings page, connector configuration
**Example:**
```typescript
// Store connector state in user_preferences table
await db.insert(userPreferences).values({
  userId,
  key: 'connector.linear.enabled',
  value: 'true'
})
```

## Common Pitfalls

1. **Missing webhook signature verification** - Always verify HMAC signatures
2. **Rate limit exhaustion** - Implement exponential backoff and caching
3. **Missing teamId for Vercel team projects** - Check access_token response for team scope
4. **Linear API pagination** - Use cursor-based pagination for large result sets

## Sources

- Linear GraphQL API Documentation
- Vercel API Documentation  
- MCP Protocol Specification
- GitHub Webhooks Documentation
- Existing codebase: `.planning/codebase/INTEGRATIONS.md`

**Research date:** 2026-02-01  
**Valid until:** 2026-03-01 (30 days - APIs are stable)
