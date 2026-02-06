import { generateState } from 'arctic'
import { linear } from '@/lib/linear'
import { cookies } from 'next/headers'

export async function GET(): Promise<Response> {
  const state = generateState()
  // Linear requires 'read' scope, can add 'write' for issue updates
  const url = linear.createAuthorizationURL(state, ['read', 'write'])

  const cookieStore = await cookies()
  cookieStore.set('linear_oauth_state', state, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  })

  return Response.redirect(url)
}
