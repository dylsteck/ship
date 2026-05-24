/**
 * Centralized API module for **client** code (hooks, SDK bootstrap, shared types).
 *
 * Server Components should import from `@/lib/api/server`.
 */
export * from './hooks'
export { setApiToken, getApiToken, configureWebShipClient, API_URL } from './configure'
export { wsUrl } from './ws'

export type {
  Session as ChatSession,
  CreateSessionBody as CreateSessionParams,
  SandboxStatus,
  ChatMessage,
  ChatTask,
  GitState,
  ModelInfo,
  AgentInfo,
  User,
  Connector,
  GitHubRepo,
} from '@ship/sdk'

export type { MessagePart, Message, RawEvent } from './chat-types'

export {
  getSession,
  getSessionSandbox,
  fetchChatMessages as getChatMessages,
  fetchChatEvents as getChatEvents,
  sendChatMessage,
  stopChatStream,
  subscribeToChatStream,
  retryChatSession,
  streamSubagentSession,
} from './chat-client'
export type { SessionSandboxStatus, BrowserChatSession } from './chat-client'
