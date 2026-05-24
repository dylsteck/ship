import { Hono } from 'hono'
import type { Env } from '../env.d'
import spec from '../../openapi/ship-api.openapi.json'

const openapi = new Hono<{ Bindings: Env }>()

/** Serve the committed OpenAPI document. */
openapi.get('/', (c) => c.json(spec))

export default openapi
