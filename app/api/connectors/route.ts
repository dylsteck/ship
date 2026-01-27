import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { connectors, insertConnectorSchema } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils/id'
import { getServerSession } from '@/lib/session/get-server-session'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userConnectors = await db.select().from(connectors).where(eq(connectors.userId, session.user.id))

    // Decrypt sensitive fields for the response (but don't send actual secrets)
    const safeConnectors = userConnectors.map((connector) => ({
      ...connector,
      env: connector.env ? '***' : null,
      oauthClientSecret: connector.oauthClientSecret ? '***' : null,
    }))

    return NextResponse.json({ connectors: safeConnectors })
  } catch (error) {
    console.error('Error fetching connectors:', error)
    return NextResponse.json({ error: 'Failed to fetch connectors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const connectorId = generateId(12)
    const validatedData = insertConnectorSchema.parse({
      ...body,
      id: connectorId,
      userId: session.user.id,
    })

    // Encrypt sensitive fields
    const encryptedEnv = validatedData.env ? encrypt(JSON.stringify(validatedData.env)) : null
    const encryptedSecret = body.oauthClientSecret ? encrypt(body.oauthClientSecret) : null

    const [newConnector] = await db
      .insert(connectors)
      .values({
        ...validatedData,
        id: connectorId,
        env: encryptedEnv,
        oauthClientSecret: encryptedSecret,
      })
      .returning()

    return NextResponse.json({
      connector: {
        ...newConnector,
        env: newConnector.env ? '***' : null,
        oauthClientSecret: newConnector.oauthClientSecret ? '***' : null,
      },
    })
  } catch (error) {
    console.error('Error creating connector:', error)
    return NextResponse.json({ error: 'Failed to create connector' }, { status: 500 })
  }
}
