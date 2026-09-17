import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('Ship Worker runtime', () => {
  it('boots with the production-equivalent bindings and serves health', async () => {
    const response = await exports.default.fetch(new Request('https://ship.test/health'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })
})
