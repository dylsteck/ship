import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import users from './routes/users'
import sessions from './routes/sessions'
import chat from './routes/chat'
import sandbox from './routes/sandbox'
import git from './routes/git'
import models from './routes/models'
import accounts from './routes/accounts'
import linear from './routes/linear'
import connectors from './routes/connectors'
import mcp from './routes/mcp'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

// CORS middleware
const allowedOrigins = new Set([
  'http://localhost:3000',
  'https://ship.dylansteck.com',
])

app.use(
  '/*',
  cors({
    origin: (origin) => {
      if (!origin) return undefined
      return allowedOrigins.has(origin) ? origin : undefined
    },
    credentials: true,
  })
)

// Routes
app.route('/health', health)
app.route('/users', users)
app.route('/sessions', sessions)
app.route('/chat', chat)
app.route('/sandbox', sandbox)
app.route('/git', git)
app.route('/models', models)
app.route('/accounts', accounts)
app.route('/linear', linear)
app.route('/connectors', connectors)
app.route('/mcp', mcp)

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
