import { github } from '@/lib/github'
import { fetchGitHubOAuthUser, fetchPrimaryGitHubEmail } from '@/services/github'
import { storeGitHubOAuthAccount, upsertOAuthUser } from '@/services/oauth'
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
    // GitHub OAuth Apps without token rotation omit `expires_in`; arctic throws when it's missing.
    let expiresAtSec: number | null = null
    try {
      expiresAtSec = Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000)
    } catch {
      expiresAtSec = null
    }

    const githubUser = await fetchGitHubOAuthUser(accessToken)
    if (!githubUser) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?error=auth_failed',
        },
      })
    }

    // Get primary email if not public
    let email = githubUser.email
    if (!email) {
      email = await fetchPrimaryGitHubEmail(accessToken)
    }

    const upsertResult = await upsertOAuthUser({
      githubId: githubUser.id.toString(),
      username: githubUser.login,
      email: email ?? undefined,
      avatarUrl: githubUser.avatar_url ?? undefined,
      name: githubUser.name ?? undefined,
    })

    if (!upsertResult.ok && upsertResult.accessRestricted) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?error=access_restricted',
        },
      })
    }

    if (!upsertResult.ok) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?error=auth_failed',
        },
      })
    }

    const { userId, isNewUser } = upsertResult

    // Store GitHub account with access token for repo access
    await storeGitHubOAuthAccount({
      userId,
      providerAccountId: githubUser.id.toString(),
      accessToken,
      refreshToken: refreshToken ?? undefined,
      expiresAt: expiresAtSec ?? undefined,
      tokenType: 'Bearer',
      scope: 'repo,read:user,user:email',
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
