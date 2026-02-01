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

    // Fetch GitHub user
    const githubUserResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
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
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      })

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json()
        const primaryEmail = emails.find((e: any) => e.primary)
        email = primaryEmail?.email ?? null
      }
    }

    // Upsert user via API
    const apiResponse = await fetch(`${process.env.API_BASE_URL}/users/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?error=auth_failed',
        },
      })
    }

    const { userId, isNewUser } = await apiResponse.json()

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
