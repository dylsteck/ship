import { Hono } from 'hono'
import { Effect } from 'effect'
import type { Env } from '../env.d'
import spec from '../../openapi/ship-api.openapi.json'
import { runToResponse } from '../effect/http'

const openapi = new Hono<{ Bindings: Env }>()

/** Serve the committed OpenAPI document. */
openapi.get('/', () => runToResponse(Effect.succeed(spec), (body) => Response.json(body)))

export default openapi
