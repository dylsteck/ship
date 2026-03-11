import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { chatRateLimit, sessionRateLimit } from './middleware/rate-limit'
import health from './routes/health'
import users from './routes/users'
import sessions from './routes/sessions'
import chat from './routes/chat'
import sandbox from './routes/sandbox'
import git from './routes/git'
import models from './routes/models'
import accounts from './routes/accounts'
import connectors from './routes/connectors'
import terminal from './routes/terminal'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env; Variables: { userId?: string } }>()

// CORS middleware
app.use(
  '/*',
  cors({
    origin: (origin, c) => {
      const raw = c.env.ALLOWED_ORIGINS ?? 'http://localhost:3000'
      const allowed = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
      const allowedSet = new Set(allowed)

      // No origin (e.g. server-side fetch, curl) — allow if we have any origins configured
      if (!origin) return allowed[0] ?? '*'

      // Exact match
      if (allowedSet.has(origin)) return origin

      // Project-scoped Vercel preview matching (rejects arbitrary *.vercel.app origins)
      if (allowedSet.has('*.vercel.app') && origin.endsWith('.vercel.app')) {
        const vercelProject = c.env.VERCEL_PROJECT_NAME || 'ship'
        const subdomain = origin.replace('https://', '').replace('.vercel.app', '')
        if (subdomain.startsWith(`${vercelProject}-`) || subdomain === vercelProject) {
          return origin
        }
      }

      return undefined
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Accept', 'Authorization'],
    exposeHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
  }),
)

// Auth middleware (all routes except /health and root)
app.use('/sessions/*', authMiddleware)
app.use('/sessions', authMiddleware)
app.use('/chat/*', authMiddleware)
app.use('/sandbox/*', authMiddleware)
app.use('/git/*', authMiddleware)
app.use('/models/*', authMiddleware)
app.use('/accounts/*', authMiddleware)
app.use('/users/*', authMiddleware)
app.use('/connectors/*', authMiddleware)
app.use('/terminal/*', authMiddleware)

// Rate limiting (after auth so userId is available)
app.use('/chat/*', chatRateLimit)
app.post('/sessions', sessionRateLimit)

// Routes
app.route('/health', health)
app.route('/users', users)
app.route('/sessions', sessions)
app.route('/chat', chat)
app.route('/sandbox', sandbox)
app.route('/git', git)
app.route('/models', models)
app.route('/accounts', accounts)
app.route('/connectors', connectors)
app.route('/terminal', terminal)

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
