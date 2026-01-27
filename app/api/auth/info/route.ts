import type { NextRequest } from 'next/server'
import type { Session, SessionUserInfo } from '@/lib/session/types'
import { saveSession } from '@/lib/session/create-github'
import { getSessionFromReq } from '@/lib/session/server'

export async function GET(req: NextRequest) {
  const session = await getSessionFromReq(req)

  const response = new Response(JSON.stringify(getData(session)), {
    headers: { 'Content-Type': 'application/json' },
  })

  if (session) {
    await saveSession(response, session)
  }

  return response
}

function getData(session: Session | undefined): SessionUserInfo {
  if (!session) {
    return { user: undefined }
  } else {
    return { user: session.user, authProvider: session.authProvider }
  }
}
