import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import users from './routes/users'
import sessions from './routes/sessions'
import chat from './routes/chat'
import sandbox from './routes/sandbox'
import git from './routes/git'
import models from './routes/models'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

// CORS middleware
app.use('/*', cors())

// Routes
app.route('/health', health)
app.route('/users', users)
app.route('/sessions', sessions)
app.route('/chat', chat)
app.route('/sandbox', sandbox)
app.route('/git', git)
app.route('/models', models)

// Root endpoint
app.get('/', (c) => {
  // Check for E2B_API_KEY on startup
  if (!c.env.E2B_API_KEY) {
    console.warn('Warning: E2B_API_KEY environment variable not set. Sandbox provisioning will fail.')
  }

  return c.json({
    name: 'Ship API',
    version: '2.0.0',
  })
})

export default app

// Export Durable Objects for Cloudflare binding
export { SessionDO } from './durable-objects/session'
