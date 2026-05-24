/**
 * REST request/response Zod schemas for the Ship API.
 *
 * @remarks
 * Used for Worker request validation and OpenAPI spec generation.
 * Streaming wire events live in `@ship/contracts`, not here.
 */

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
export { gitStateSchema } from './git-schemas'

extendZodWithOpenApi(z)

export const uuidParamSchema = z.string().uuid()

export const errorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  issues: z.unknown().optional(),
})

export const successSchema = z.object({
  success: z.boolean(),
})

export const createSessionBodySchema = z
  .object({
    repoOwner: z.string().min(1).max(200),
    repoName: z.string().min(1).max(200),
    model: z.string().max(200).optional(),
    agentType: z.string().max(64).optional(),
    title: z.string().max(500).optional(),
    baseBranch: z.string().max(256).optional(),
  })
  .openapi('CreateSessionBody')

export const sessionSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    repoOwner: z.string(),
    repoName: z.string(),
    status: z.string(),
    lastActivity: z.number().int(),
    createdAt: z.number().int(),
    archivedAt: z.number().int().nullable(),
    title: z.string().optional(),
    model: z.string().optional(),
    agentType: z.string().optional(),
    sandboxId: z.string().nullable().optional(),
    sandboxStatus: z.string().optional(),
    messageCount: z.number().int().optional(),
  })
  .openapi('Session')

export const deleteAllSessionsResponseSchema = z
  .object({
    success: z.boolean(),
    deletedCount: z.number().int(),
  })
  .openapi('DeleteAllSessionsResponse')

export const sandboxStatusSchema = z
  .object({
    sandboxId: z.string().nullable().optional(),
    status: z.string().optional(),
    ready: z.boolean().optional(),
    sandboxAgentUrl: z.string().nullable().optional(),
    agentSessionId: z.string().nullable().optional(),
    agentType: z.string().nullable().optional(),
    url: z.string().optional(),
    terminalUrl: z.string().optional(),
  })
  .openapi('SandboxStatus')

export const sandboxProvisionBodySchema = z
  .object({
    sessionId: uuidParamSchema,
  })
  .openapi('SandboxProvisionBody')

export const sandboxInfoSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    createdAt: z.number().int(),
    metadata: z.record(z.unknown()).optional(),
  })
  .openapi('SandboxInfo')

export const chatPostBodySchema = z
  .object({
    content: z.string().max(100_000),
    mode: z.string().max(64).optional(),
    model: z.string().max(200).optional(),
  })
  .openapi('ChatPostBody')

export const chatMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    parts: z.unknown().optional(),
    createdAt: z.union([z.string(), z.number()]),
  })
  .openapi('ChatMessage')

export const chatEventSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    timestamp: z.union([z.string(), z.number()]),
    payload: z.unknown(),
  })
  .openapi('ChatEvent')

export const chatTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.string(),
    mode: z.string().optional(),
    createdAt: z.union([z.string(), z.number()]),
    completedAt: z.union([z.string(), z.number()]).optional(),
  })
  .openapi('ChatTask')

export const questionReplyBodySchema = z
  .object({
    response: z.string().min(1),
  })
  .openapi('QuestionReplyBody')

export const permissionReplyBodySchema = z
  .object({
    reply: z.enum(['once', 'always', 'reject']).optional(),
  })
  .openapi('PermissionReplyBody')

export const userSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .openapi('User')

export const upsertUserBodySchema = z
  .object({
    githubId: z.string(),
    username: z.string(),
    email: z.string().optional(),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
  })
  .openapi('UpsertUserBody')

export const upsertUserResponseSchema = z
  .object({
    userId: z.string().uuid(),
    isNewUser: z.boolean(),
  })
  .openapi('UpsertUserResponse')

export const modelInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    description: z.string().optional(),
    contextWindow: z.number().optional(),
    maxTokens: z.number().optional(),
    isDefault: z.boolean().optional(),
    isFree: z.boolean().optional(),
    source: z.string().optional(),
    upstreamModelId: z.string().optional(),
  })
  .openapi('ModelInfo')

export const modelRefSchema = z.object({ model: z.string() }).openapi('ModelRef')

export const defaultModelResponseSchema = z.object({ model: z.string() }).openapi('DefaultModelResponse')

export const sessionModelResponseSchema = z
  .object({
    model: z.string(),
    override: z.boolean(),
  })
  .openapi('SessionModelResponse')

export const agentInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    modes: z.array(z.object({ id: z.string(), name: z.string() })),
    models: z.array(modelInfoSchema),
  })
  .openapi('AgentInfo')

export const agentIdRefSchema = z.object({ agentId: z.string() }).openapi('AgentIdRef')

export const agentModelRefSchema = z
  .object({
    agentId: z.string(),
    model: z.string(),
  })
  .openapi('AgentModelRef')

export const agentModelResponseSchema = z
  .object({
    model: z.string().nullable(),
  })
  .openapi('AgentModelResponse')

export const githubAccountBodySchema = z
  .object({
    userId: z.string().uuid(),
    providerAccountId: z.string(),
    accessToken: z.string(),
    refreshToken: z.string().nullable().optional(),
    expiresAt: z.number().nullable().optional(),
    tokenType: z.string().optional(),
    scope: z.string().optional(),
  })
  .openapi('GitHubAccountBody')

export const accountSuccessSchema = z
  .object({
    success: z.boolean(),
    accountId: z.string().uuid(),
  })
  .openapi('AccountSuccess')

export const defaultRepoResponseSchema = z
  .object({
    repoFullName: z.string().nullable(),
  })
  .openapi('DefaultRepoResponse')

export const defaultRepoBodySchema = z.object({ repoFullName: z.string() }).openapi('DefaultRepoBody')

export const githubRepoSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    fullName: z.string(),
    owner: z.string(),
    description: z.string().nullable(),
    private: z.boolean(),
    updatedAt: z.string(),
    language: z.string().nullable(),
    stars: z.number(),
    defaultBranch: z.string(),
  })
  .openapi('GitHubRepo')

export const githubReposResponseSchema = z
  .object({
    repos: z.array(githubRepoSchema),
    hasMore: z.boolean(),
    nextPage: z.number().nullable(),
  })
  .openapi('GitHubReposResponse')

export const connectorSchema = z
  .object({
    name: z.string(),
    connected: z.boolean(),
    enabled: z.boolean(),
    tokenExpired: z.boolean().optional(),
  })
  .openapi('Connector')

export const connectorsResponseSchema = z
  .object({
    connectors: z.array(connectorSchema),
  })
  .openapi('ConnectorsResponse')

export const connectorStatusSchema = z
  .object({
    name: z.string(),
    connected: z.boolean(),
    enabled: z.boolean(),
  })
  .openapi('ConnectorStatus')

export const connectorToggleResponseSchema = z
  .object({
    success: z.boolean(),
    enabled: z.boolean(),
  })
  .openapi('ConnectorToggleResponse')
