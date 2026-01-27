import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getOAuthToken } from '@/lib/session/get-oauth-token'
import { Octokit } from '@octokit/rest'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get GitHub token
    const tokenData = await getOAuthToken(session.user.id, 'github')
    if (!tokenData) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    const octokit = new Octokit({
      auth: tokenData.accessToken,
    })

    // Fetch user's repositories
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    })

    return NextResponse.json({
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        private: repo.private,
        owner: repo.owner.login,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        stargazersCount: repo.stargazers_count,
        language: repo.language,
      })),
    })
  } catch (error) {
    console.error('Error fetching repos:', error)
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 })
  }
}
