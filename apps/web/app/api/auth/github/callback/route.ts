import { github } from '@/lib/github'
import { createSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('github_oauth_state')?.value ?? null

  if (!code || !state || !storedState || state !== storedState) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/login?error=auth_failed',
      },
    })
  }

  try {
    const tokens = await github.validateAuthorizationCode(code)
    const accessToken = tokens.accessToken()
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null
    const expiresAtSec = tokens.accessTokenExpiresAt()
      ? Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000)
      : null

    // Fetch GitHub user
    const githubUserResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!githubUserResponse.ok) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?error=auth_failed',
        },
      })
    }

    const githubUser = await githubUserResponse.json()

    // Get primary email if not public
    let email = githubUser.email
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json()
        const primaryEmail = emails.find((e: { email: string; primary: boolean; verified: boolean }) => e.primary)
        email = primaryEmail?.email ?? null
      }
    }

    // Upsert user via API
    const apiResponse = await fetch(`${process.env.API_BASE_URL}/users/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_SECRET}`,
      },
      body: JSON.stringify({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url,
        name: githubUser.name,
      }),
    })

    if (!apiResponse.ok) {
      if (apiResponse.status === 403) {
        const body = await apiResponse.json()
        if (body?.error === 'access_restricted') {
          return new Response(null, {
            status: 302,
            headers: {
              Location: '/login?error=access_restricted',
            },
          })
        }
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?error=auth_failed',
        },
      })
    }

    const { userId, isNewUser } = await apiResponse.json()

    // Store GitHub account with access token for repo access
    await fetch(`${process.env.API_BASE_URL}/accounts/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_SECRET}`,
      },
      body: JSON.stringify({
        userId,
        providerAccountId: githubUser.id.toString(),
        accessToken,
        refreshToken: refreshToken ?? undefined,
        expiresAt: expiresAtSec ?? undefined,
        tokenType: 'Bearer',
        scope: 'repo,read:user,user:email',
      }),
    })

    // Create session
    await createSession(userId)

    // Redirect based on user status
    const redirectTo = isNewUser ? '/onboarding' : '/dashboard'

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
      },
    })
  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/login?error=auth_failed',
      },
    })
  }
}
