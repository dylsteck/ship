import { Hono } from 'hono'
import { handleChatMessageStream } from './chat-message-stream'
import { registerChatAuxiliaryRoutes } from './chat-auxiliary-routes'
import type { Env } from '../env.d'

const app = new Hono<{ Bindings: Env }>()

app.post('/:sessionId', handleChatMessageStream)
registerChatAuxiliaryRoutes(app)

export default app
