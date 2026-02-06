import { generateState } from 'arctic'
import { github } from '@/lib/github'
import { cookies } from 'next/headers'

export async function GET(): Promise<Response> {
  const state = generateState()
  const url = github.createAuthorizationURL(state, ['read:user', 'user:email', 'repo'])

  const cookieStore = await cookies()
  cookieStore.set('github_oauth_state', state, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  })

  return Response.redirect(url)
}
