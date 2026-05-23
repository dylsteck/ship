const GITHUB_API_URL = 'https://api.github.com'

/** GitHub user payload returned by `GET /user` during OAuth sign-in. */
export interface GitHubOAuthUser {
  id: number
  login: string
  email: string | null
  avatar_url: string | null
  name: string | null
}

interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

function githubHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

/**
 * Fetch the authenticated GitHub user for an OAuth access token.
 *
 * @param accessToken - GitHub OAuth access token from the authorization-code exchange.
 */
export async function fetchGitHubOAuthUser(accessToken: string): Promise<GitHubOAuthUser | null> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: githubHeaders(accessToken),
  })

  if (!response.ok) return null

  return response.json()
}

/**
 * Fetch the user's primary GitHub email when it is not public on their profile.
 *
 * @param accessToken - GitHub OAuth access token with `user:email` scope.
 */
export async function fetchPrimaryGitHubEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(`${GITHUB_API_URL}/user/emails`, {
    headers: githubHeaders(accessToken),
  })

  if (!response.ok) return null

  const emails = (await response.json()) as GitHubEmail[]
  const primaryEmail = emails.find((email) => email.primary)
  return primaryEmail?.email ?? null
}
