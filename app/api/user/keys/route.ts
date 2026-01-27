import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { keys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils/id'
import { getServerSession } from '@/lib/session/get-server-session'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userKeys = await db.select().from(keys).where(eq(keys.userId, session.user.id))

    // Return keys without the actual values (just which providers have keys)
    const safeKeys = userKeys.map((key) => ({
      id: key.id,
      provider: key.provider,
      hasKey: true,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }))

    return NextResponse.json({ keys: safeKeys })
  } catch (error) {
    console.error('Error fetching keys:', error)
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, value } = body

    if (!provider || !value) {
      return NextResponse.json({ error: 'Provider and value are required' }, { status: 400 })
    }

    // Encrypt the key value
    const encryptedValue = encrypt(value)

    // Check if key already exists for this provider
    const existingKey = await db
      .select()
      .from(keys)
      .where(and(eq(keys.userId, session.user.id), eq(keys.provider, provider)))
      .limit(1)

    if (existingKey.length > 0) {
      // Update existing key
      const [updatedKey] = await db
        .update(keys)
        .set({
          value: encryptedValue,
          updatedAt: new Date(),
        })
        .where(eq(keys.id, existingKey[0].id))
        .returning()

      return NextResponse.json({
        key: {
          id: updatedKey.id,
          provider: updatedKey.provider,
          hasKey: true,
          updatedAt: updatedKey.updatedAt,
        },
      })
    }

    // Create new key
    const [newKey] = await db
      .insert(keys)
      .values({
        id: generateId(12),
        userId: session.user.id,
        provider,
        value: encryptedValue,
      })
      .returning()

    return NextResponse.json({
      key: {
        id: newKey.id,
        provider: newKey.provider,
        hasKey: true,
        createdAt: newKey.createdAt,
      },
    })
  } catch (error) {
    console.error('Error saving key:', error)
    return NextResponse.json({ error: 'Failed to save key' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const provider = url.searchParams.get('provider') as 'anthropic' | 'openai' | 'cursor' | 'gemini' | 'aigateway' | null

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
    }

    const validProviders = ['anthropic', 'openai', 'cursor', 'gemini', 'aigateway'] as const
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    await db.delete(keys).where(and(eq(keys.userId, session.user.id), eq(keys.provider, provider)))

    return NextResponse.json({ message: 'Key deleted successfully' })
  } catch (error) {
    console.error('Error deleting key:', error)
    return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
  }
}
