import { linear } from '@/lib/linear'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('linear_oauth_state')?.value ?? null

  if (!code || !state || !storedState || state !== storedState) {
    redirect('/settings?error=linear_auth_failed')
  }

  // Get current user session
  const session = await getSession()
  if (!session?.userId) {
    redirect('/login?error=session_required')
  }

  try {
    const tokens = await linear.validateAuthorizationCode(code)

    // Fetch Linear user info via GraphQL
    const linearUserResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
      body: JSON.stringify({
        query: `
          query {
            viewer {
              id
              name
              email
              avatarUrl
            }
          }
        `,
      }),
    })

    if (!linearUserResponse.ok) {
      redirect('/settings?error=linear_auth_failed')
    }

    const linearUserData = await linearUserResponse.json()
    const linearUser = linearUserData.data?.viewer

    if (!linearUser) {
      redirect('/settings?error=linear_auth_failed')
    }

    // Store Linear account via API
    // Note: Linear access tokens don't expire, so expiresAt is set to null
    const apiResponse = await fetch(`${process.env.API_BASE_URL}/accounts/linear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: session.userId,
        providerAccountId: linearUser.id,
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken() || null,
        expiresAt: null, // Linear tokens don't expire
        tokenType: tokens.tokenType() || 'Bearer',
        scope: tokens.scopes().join(' ') || 'read write',
      }),
    })

    if (!apiResponse.ok) {
      redirect('/settings?error=linear_auth_failed')
    }

    // Clear state cookie
    cookieStore.delete('linear_oauth_state')

    // Redirect to settings page
    redirect('/settings?linear_connected=true')
  } catch (error) {
    console.error('Linear OAuth callback error:', error)
    redirect('/settings?error=linear_auth_failed')
  }
}
