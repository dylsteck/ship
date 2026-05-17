import { Hono } from 'hono'
import { handleChatMessageStream } from './chat-message-stream'
import { registerChatAuxiliaryRoutes } from './chat-auxiliary-routes'
import type { AuthedEnv } from '../lib/session-authorization'

const app = new Hono<AuthedEnv>()

app.post('/:sessionId', handleChatMessageStream)
registerChatAuxiliaryRoutes(app)

export default app
