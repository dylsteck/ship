import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getOAuthToken } from '@/lib/session/get-oauth-token'
import { Octokit } from '@octokit/rest'

interface RouteParams {
  params: Promise<{ owner: string; repo: string; type: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo, type } = await params
    const tokenData = await getOAuthToken(session.user.id, 'github')

    if (!tokenData) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })
    }

    const octokit = new Octokit({ auth: tokenData.accessToken })

    switch (type) {
      case 'commits': {
        const { data } = await octokit.repos.listCommits({
          owner,
          repo,
          per_page: 30,
        })
        const commits = data.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0],
          author: commit.commit.author?.name || commit.author?.login || 'Unknown',
          date: commit.commit.author?.date || '',
          url: commit.html_url,
        }))
        return NextResponse.json({ commits })
      }

      case 'issues': {
        const { data } = await octokit.issues.listForRepo({
          owner,
          repo,
          state: 'all',
          per_page: 30,
        })
        // Filter out pull requests (they show up in issues API too)
        const issues = data
          .filter((issue) => !issue.pull_request)
          .map((issue) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state as 'open' | 'closed',
            author: issue.user?.login || 'Unknown',
            createdAt: issue.created_at,
            url: issue.html_url,
            labels: issue.labels
              .filter((label): label is { name: string; color: string } => typeof label === 'object' && label !== null)
              .map((label) => ({
                name: label.name || '',
                color: label.color || '888888',
              })),
          }))
        return NextResponse.json({ issues })
      }

      case 'pulls': {
        const { data } = await octokit.pulls.list({
          owner,
          repo,
          state: 'all',
          per_page: 30,
        })
        const pulls = data.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
          author: pr.user?.login || 'Unknown',
          createdAt: pr.created_at,
          url: pr.html_url,
          head: pr.head.ref,
          base: pr.base.ref,
        }))
        return NextResponse.json({ pulls })
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error fetching repo data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
