import { Hono } from 'hono'
import { Effect } from 'effect'
import { runToResponse } from '../effect/http'

const health = new Hono()

health.get('/', () =>
  runToResponse(
    Effect.succeed({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    (body) => Response.json(body),
  ),
)

export default health
