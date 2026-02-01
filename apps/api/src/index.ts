import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'

const app = new Hono()

// CORS middleware
app.use('/*', cors())

// Routes
app.route('/health', health)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Ship API',
    version: '2.0.0',
  })
})

export default app
