import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import users from './routes/users'
import sessions from './routes/sessions'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

// CORS middleware
app.use('/*', cors())

// Routes
app.route('/health', health)
app.route('/users', users)
app.route('/sessions', sessions)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Ship API',
    version: '2.0.0',
  })
})

export default app

// Export Durable Objects for Cloudflare binding
export { SessionDO } from './durable-objects/session'
