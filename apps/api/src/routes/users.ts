import { Hono } from 'hono'
import type { CreateUserInput, UserDTO } from '@ship/types'

// Define the environment bindings
interface Env {
  DB: D1Database
}

const users = new Hono<{ Bindings: Env }>()

/**
 * POST /users/upsert
 * Create or update user by GitHub ID
 */
users.post('/upsert', async (c) => {
  try {
    const input: CreateUserInput = await c.req.json()

    // Validate required fields
    if (!input.githubId || !input.username) {
      return c.json({ error: 'githubId and username are required' }, 400)
    }

    // Generate user ID
    const userId = crypto.randomUUID()

    // Check if user exists by GitHub ID
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE github_id = ?'
    )
      .bind(input.githubId)
      .first<{ id: string }>()

    const now = Math.floor(Date.now() / 1000)

    if (existing) {
      // Update existing user
      await c.env.DB.prepare(
        `UPDATE users
         SET username = ?, email = ?, name = ?, avatar_url = ?, updated_at = ?
         WHERE github_id = ?`
      )
        .bind(
          input.username,
          input.email || null,
          input.name || null,
          input.avatarUrl || null,
          now,
          input.githubId
        )
        .run()

      return c.json({
        userId: existing.id,
        isNewUser: false,
      })
    } else {
      // Insert new user
      await c.env.DB.prepare(
        `INSERT INTO users (id, github_id, username, email, name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          userId,
          input.githubId,
          input.username,
          input.email || null,
          input.name || null,
          input.avatarUrl || null,
          now,
          now
        )
        .run()

      return c.json({
        userId,
        isNewUser: true,
      })
    }
  } catch (error) {
    console.error('Error upserting user:', error)
    return c.json({ error: 'Failed to upsert user' }, 500)
  }
})

/**
 * GET /users/:id
 * Get user by ID
 */
users.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    const user = await c.env.DB.prepare(
      'SELECT id, username, email, name, avatar_url FROM users WHERE id = ?'
    )
      .bind(id)
      .first<{
        id: string
        username: string
        email: string | null
        name: string | null
        avatar_url: string | null
      }>()

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Map to DTO (camelCase)
    const userDTO: UserDTO = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
    }

    return c.json(userDTO)
  } catch (error) {
    console.error('Error fetching user:', error)
    return c.json({ error: 'Failed to fetch user' }, 500)
  }
})

export default users
