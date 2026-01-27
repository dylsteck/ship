import type { NextRequest } from 'next/server'
import { getSessionFromReq } from '@/lib/session/server'
import { isRelativeUrl } from '@/lib/utils/is-relative-url'
import { saveSession } from '@/lib/session/create-github'
import { getOAuthToken } from '@/lib/session/get-oauth-token'

export async function GET(req: NextRequest) {
  const session = await getSessionFromReq(req)

  if (session) {
    // Revoke GitHub token
    try {
      const tokenData = await getOAuthToken(session.user.id, 'github')
      if (tokenData) {
        await fetch(`https://api.github.com/applications/${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}/token`, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ access_token: tokenData.accessToken }),
        })
      }
    } catch (error) {
      console.error('Failed to revoke GitHub token:', error)
    }
  }

  const response = Response.json({
    url: isRelativeUrl(req.nextUrl.searchParams.get('next') ?? '/') ? req.nextUrl.searchParams.get('next') : '/',
  })

  await saveSession(response, undefined)
  return response
}
