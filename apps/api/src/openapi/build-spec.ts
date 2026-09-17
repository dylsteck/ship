/**
 * Build the Ship OpenAPI 3.1 document from Zod schemas.
 *
 * @packageDocumentation
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  accountSuccessSchema,
  agentIdRefSchema,
  agentInfoSchema,
  agentModelRefSchema,
  agentModelResponseSchema,
  chatEventSchema,
  chatMessageSchema,
  chatPostBodySchema,
  chatTaskSchema,
  connectorStatusSchema,
  connectorToggleResponseSchema,
  connectorsResponseSchema,
  createTurnBodySchema,
  createSessionBodySchema,
  defaultModelResponseSchema,
  defaultRepoBodySchema,
  defaultRepoResponseSchema,
  deleteAllSessionsResponseSchema,
  desktopStateSchema,
  errorSchema,
  gitStateSchema,
  gitMergeBodySchema,
  gitMergeResponseSchema,
  githubAccountBodySchema,
  githubReposResponseSchema,
  modelInfoSchema,
  modelPreferencesSchema,
  modelRefSchema,
  permissionReplyBodySchema,
  questionReplyBodySchema,
  realtimeTicketBodySchema,
  realtimeTicketResponseSchema,
  sandboxInfoSchema,
  sandboxProvisionBodySchema,
  sandboxStatusSchema,
  sessionModelResponseSchema,
  sessionSelectionResponseSchema,
  sessionSchema,
  successSchema,
  toolOutputResponseSchema,
  transcriptPageSchema,
  turnAcceptedResponseSchema,
  updateModelPreferencesBodySchema,
  updateSessionSelectionBodySchema,
  upsertUserBodySchema,
  upsertUserResponseSchema,
  userSchema,
} from './schemas'

const registry = new OpenAPIRegistry()

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Session JWT from Ship web login',
})

const serviceAuth = registry.registerComponent('securitySchemes', 'serviceAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'API_SECRET for server-to-server calls only',
})

const sessionIdParam = registry.registerParameter(
  'SessionId',
  z.string().uuid().openapi({ param: { name: 'sessionId', in: 'path' } }),
)

function jsonResponse(schema: z.ZodType, description: string) {
  return {
    description,
    content: { 'application/json': { schema } },
  }
}

function sseResponse(description: string) {
  return {
    description,
    content: {
      'text/event-stream': {
        schema: { type: 'string' as const },
      },
    },
    'x-ship-transport': 'sse',
  }
}

function registerPaths(): void {
  // Sessions
  registry.registerPath({
    method: 'get',
    path: '/sessions',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
      200: jsonResponse(z.array(sessionSchema), 'List sessions'),
      401: jsonResponse(errorSchema, 'Unauthorized'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/sessions',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: createSessionBodySchema } } } },
    responses: {
      201: jsonResponse(sessionSchema, 'Created session'),
      400: jsonResponse(errorSchema, 'Validation error'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/sessions',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
      200: jsonResponse(deleteAllSessionsResponseSchema, 'Deleted all sessions'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/sessions/{sessionId}',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: {
      200: jsonResponse(sessionSchema, 'Session detail'),
      404: jsonResponse(errorSchema, 'Not found'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/sessions/{sessionId}',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: {
      200: jsonResponse(successSchema, 'Deleted'),
      404: jsonResponse(errorSchema, 'Not found'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/sessions/{sessionId}/sandbox',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: {
      200: jsonResponse(sandboxStatusSchema, 'Sandbox status'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/sessions/{sessionId}/turns',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      body: { content: { 'application/json': { schema: createTurnBodySchema } } },
    },
    responses: {
      202: jsonResponse(turnAcceptedResponseSchema, 'Turn accepted'),
      409: jsonResponse(errorSchema, 'Session already has an active turn'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/sessions/{sessionId}/turns/{turnId}/stop',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({
        sessionId: sessionIdParam,
        turnId: z.string().openapi({ param: { name: 'turnId', in: 'path' } }),
      }),
    },
    responses: {
      200: jsonResponse(successSchema.extend({ turnId: z.string() }), 'Stop requested'),
      409: jsonResponse(errorSchema, 'Turn is not running'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/sessions/{sessionId}/transcript',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      query: z.object({ before: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).optional() }),
    },
    responses: { 200: jsonResponse(transcriptPageSchema, 'Older transcript page') },
  })

  registry.registerPath({
    method: 'get',
    path: '/sessions/{sessionId}/tool-calls/{toolCallId}/output',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({
        sessionId: sessionIdParam,
        toolCallId: z.string().openapi({ param: { name: 'toolCallId', in: 'path' } }),
      }),
    },
    responses: {
      200: jsonResponse(toolOutputResponseSchema, 'Full tool output'),
      404: jsonResponse(errorSchema, 'Tool output not found'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/sessions/{sessionId}/selection',
    tags: ['Sessions'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      body: { content: { 'application/json': { schema: updateSessionSelectionBodySchema } } },
    },
    responses: {
      200: jsonResponse(sessionSelectionResponseSchema, 'Selection updated'),
      409: jsonResponse(errorSchema, 'Session is busy'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/realtime/tickets',
    tags: ['Realtime'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: realtimeTicketBodySchema } } } },
    responses: { 200: jsonResponse(realtimeTicketResponseSchema, 'Short-lived one-use ticket') },
  })

  // Chat SSE
  registry.registerPath({
    method: 'post',
    path: '/chat/{sessionId}',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      body: { content: { 'application/json': { schema: chatPostBodySchema } } },
    },
    responses: {
      200: sseResponse('SSE stream of chat events'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/chat/{sessionId}/subscribe',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: {
      200: sseResponse('Compatibility idle SSE'),
    },
  })

  const chatControl = (suffix: string, method: 'post' | 'get' = 'post', body?: z.ZodType) =>
    registry.registerPath({
      method,
      path: `/chat/{sessionId}${suffix}`,
      tags: ['Chat'],
      security: [{ [bearerAuth.name]: [] }],
      request: {
        params: z.object({ sessionId: sessionIdParam }),
        ...(body ? { body: { content: { 'application/json': { schema: body } } } } : {}),
      },
      responses: { 200: jsonResponse(successSchema, 'OK') },
    })

  chatControl('/stop')
  chatControl('/retry')
  chatControl('/pause')
  chatControl('/resume')
  chatControl('/git/pr/ready')

  registry.registerPath({
    method: 'get',
    path: '/chat/{sessionId}/messages',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      query: z.object({
        limit: z.string().optional(),
        before: z.string().optional(),
      }),
    },
    responses: { 200: jsonResponse(z.array(chatMessageSchema), 'Messages') },
  })

  registry.registerPath({
    method: 'post',
    path: '/chat/{sessionId}/git/pr/merge',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      body: { content: { 'application/json': { schema: gitMergeBodySchema } } },
    },
    responses: { 200: jsonResponse(gitMergeResponseSchema, 'Merged pull request') },
  })

  registry.registerPath({
    method: 'get',
    path: '/chat/{sessionId}/events',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: { 200: jsonResponse(z.array(chatEventSchema), 'Events') },
  })

  registry.registerPath({
    method: 'get',
    path: '/chat/{sessionId}/tasks',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      query: z.object({ status: z.string().optional() }),
    },
    responses: { 200: jsonResponse(z.array(chatTaskSchema), 'Tasks') },
  })

  registry.registerPath({
    method: 'get',
    path: '/chat/{sessionId}/git/state',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: { 200: jsonResponse(gitStateSchema, 'Git state') },
  })

  registry.registerPath({
    method: 'get',
    path: '/chat/{sessionId}/desktop/state',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      query: z.object({ retry: z.string().optional() }),
    },
    responses: { 200: jsonResponse(desktopStateSchema, 'Desktop state') },
  })

  registry.registerPath({
    method: 'post',
    path: '/chat/{sessionId}/permission/{permissionId}',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({
        sessionId: sessionIdParam,
        permissionId: z.string().openapi({ param: { name: 'permissionId', in: 'path' } }),
      }),
      body: { content: { 'application/json': { schema: permissionReplyBodySchema } } },
    },
    responses: { 200: jsonResponse(successSchema, 'Permission resolved') },
  })

  registry.registerPath({
    method: 'post',
    path: '/chat/{sessionId}/question/{questionId}',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({
        sessionId: sessionIdParam,
        questionId: z.string().openapi({ param: { name: 'questionId', in: 'path' } }),
      }),
      body: { content: { 'application/json': { schema: questionReplyBodySchema } } },
    },
    responses: { 200: jsonResponse(successSchema, 'Question answered') },
  })

  registry.registerPath({
    method: 'post',
    path: '/chat/{sessionId}/question/{questionId}/reject',
    tags: ['Chat'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({
        sessionId: sessionIdParam,
        questionId: z.string().openapi({ param: { name: 'questionId', in: 'path' } }),
      }),
    },
    responses: { 200: jsonResponse(successSchema, 'Question rejected') },
  })

  // Sandbox
  registry.registerPath({
    method: 'post',
    path: '/sandbox',
    tags: ['Sandbox'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: sandboxProvisionBodySchema } } } },
    responses: { 201: jsonResponse(sandboxInfoSchema, 'Sandbox provisioned') },
  })

  // Users
  registry.registerPath({
    method: 'get',
    path: '/users/me',
    tags: ['Users'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(userSchema, 'Current user') },
  })

  registry.registerPath({
    method: 'post',
    path: '/users/upsert',
    tags: ['Users'],
    security: [{ [serviceAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: upsertUserBodySchema } } } },
    responses: { 200: jsonResponse(upsertUserResponseSchema, 'Upserted user') },
  })

  registry.registerPath({
    method: 'get',
    path: '/users/{id}',
    tags: ['Users'],
    security: [{ [bearerAuth.name]: [] }, { [serviceAuth.name]: [] }],
    request: { params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }) },
    responses: { 200: jsonResponse(userSchema, 'User') },
  })

  // Models
  registry.registerPath({
    method: 'get',
    path: '/models/available',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(z.array(modelInfoSchema), 'Available models') },
  })

  registry.registerPath({
    method: 'get',
    path: '/models/default',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(defaultModelResponseSchema, 'Default model') },
  })

  registry.registerPath({
    method: 'get',
    path: '/models/preferences',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(modelPreferencesSchema, 'Model preferences') },
  })

  registry.registerPath({
    method: 'patch',
    path: '/models/preferences',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: updateModelPreferencesBodySchema } } } },
    responses: { 200: jsonResponse(modelPreferencesSchema, 'Model preferences updated') },
  })

  registry.registerPath({
    method: 'post',
    path: '/models/default',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: modelRefSchema } } } },
    responses: { 200: jsonResponse(modelRefSchema.extend({ success: z.boolean() }), 'Updated') },
  })

  registry.registerPath({
    method: 'get',
    path: '/models/sessions/{sessionId}',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ sessionId: sessionIdParam }) },
    responses: { 200: jsonResponse(sessionModelResponseSchema, 'Session model') },
  })

  registry.registerPath({
    method: 'post',
    path: '/models/sessions/{sessionId}',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ sessionId: sessionIdParam }),
      body: { content: { 'application/json': { schema: modelRefSchema } } },
    },
    responses: { 200: jsonResponse(modelRefSchema.extend({ success: z.boolean() }), 'Updated') },
  })

  registry.registerPath({
    method: 'get',
    path: '/models/agents',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(z.array(agentInfoSchema), 'Agents') },
  })

  registry.registerPath({
    method: 'get',
    path: '/models/default-agent',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(agentIdRefSchema, 'Default agent') },
  })

  registry.registerPath({
    method: 'post',
    path: '/models/default-agent',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: agentIdRefSchema } } } },
    responses: { 200: jsonResponse(agentIdRefSchema.extend({ success: z.boolean() }), 'Updated') },
  })

  registry.registerPath({
    method: 'get',
    path: '/models/default-agent-model',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: { query: z.object({ agentId: z.string() }) },
    responses: { 200: jsonResponse(agentModelResponseSchema, 'Agent default model') },
  })

  registry.registerPath({
    method: 'post',
    path: '/models/default-agent-model',
    tags: ['Models'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: agentModelRefSchema } } } },
    responses: { 200: jsonResponse(agentModelRefSchema.extend({ success: z.boolean() }), 'Updated') },
  })

  // Accounts
  registry.registerPath({
    method: 'post',
    path: '/accounts/github',
    tags: ['Accounts'],
    security: [{ [serviceAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: githubAccountBodySchema } } } },
    responses: { 200: jsonResponse(accountSuccessSchema, 'Stored account') },
  })

  registry.registerPath({
    method: 'get',
    path: '/accounts/github/default-repo',
    tags: ['Accounts'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(defaultRepoResponseSchema, 'Default repo') },
  })

  registry.registerPath({
    method: 'post',
    path: '/accounts/github/default-repo',
    tags: ['Accounts'],
    security: [{ [bearerAuth.name]: [] }],
    request: { body: { content: { 'application/json': { schema: defaultRepoBodySchema } } } },
    responses: { 200: jsonResponse(defaultRepoBodySchema.extend({ success: z.boolean() }), 'Updated') },
  })

  registry.registerPath({
    method: 'get',
    path: '/accounts/github/repos',
    tags: ['Accounts'],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      query: z.object({
        page: z.string().optional(),
        per_page: z.string().optional(),
      }),
    },
    responses: { 200: jsonResponse(githubReposResponseSchema, 'GitHub repos') },
  })

  // Connectors
  registry.registerPath({
    method: 'get',
    path: '/connectors',
    tags: ['Connectors'],
    security: [{ [bearerAuth.name]: [] }],
    responses: { 200: jsonResponse(connectorsResponseSchema, 'Connectors') },
  })

  registry.registerPath({
    method: 'get',
    path: '/connectors/{name}/status',
    tags: ['Connectors'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ name: z.string().openapi({ param: { name: 'name', in: 'path' } }) }) },
    responses: { 200: jsonResponse(connectorStatusSchema, 'Connector status') },
  })

  registry.registerPath({
    method: 'post',
    path: '/connectors/{name}/enable',
    tags: ['Connectors'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ name: z.string().openapi({ param: { name: 'name', in: 'path' } }) }) },
    responses: { 200: jsonResponse(connectorToggleResponseSchema, 'Enabled') },
  })

  registry.registerPath({
    method: 'post',
    path: '/connectors/{name}/disable',
    tags: ['Connectors'],
    security: [{ [bearerAuth.name]: [] }],
    request: { params: z.object({ name: z.string().openapi({ param: { name: 'name', in: 'path' } }) }) },
    responses: { 200: jsonResponse(connectorToggleResponseSchema, 'Disabled') },
  })
}

/**
 * Build the OpenAPI document object.
 */
export function buildOpenApiDocument(): Record<string, unknown> {
  registerPaths()
  const generator = new OpenApiGeneratorV3(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Ship API',
      version: '1.0.0',
      description:
        'REST API for Ship — coding-agent chat platform. SSE chat streaming and WebSocket endpoints are documented but served outside the JSON SDK client.',
    },
    servers: [
      { url: 'http://localhost:8787', description: 'Local wrangler dev' },
      { url: 'https://api.ship.example.com', description: 'Production (replace with deploy URL)' },
    ],
    tags: [
      { name: 'Sessions', description: 'Chat session CRUD and sandbox status' },
      { name: 'Chat', description: 'Chat turns, history, and control' },
      { name: 'Sandbox', description: 'E2B sandbox provisioning' },
      { name: 'Users', description: 'User identity' },
      { name: 'Models', description: 'Model and agent preferences' },
      { name: 'Realtime', description: 'Scoped websocket connection tickets' },
      { name: 'Accounts', description: 'GitHub account and repos' },
      { name: 'Connectors', description: 'Third-party connector settings' },
    ],
  }) as unknown as Record<string, unknown>
}
