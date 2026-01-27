import { Octokit } from '@octokit/rest'

/**
 * Detects the appropriate port for a project based on its dependencies.
 * Checks package.json from GitHub to determine if it's a Vite project.
 */
export async function detectPortFromRepo(repoUrl: string, githubToken?: string | null): Promise<number> {
  try {
    // Parse the GitHub URL to extract owner and repo
    const urlMatch = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
    if (!urlMatch) {
      return 3000
    }

    const [, owner, repo] = urlMatch

    const octokit = new Octokit({
      auth: githubToken || undefined,
    })

    // Fetch package.json from the repository
    let packageJsonContent: string
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      })

      if ('content' in data && data.type === 'file') {
        packageJsonContent = Buffer.from(data.content, 'base64').toString('utf-8')
      } else {
        return 3000
      }
    } catch (error) {
      return 3000
    }

    const packageJson = JSON.parse(packageJsonContent)

    // Check if Vite is in dependencies or devDependencies
    const hasVite =
      (packageJson.dependencies && 'vite' in packageJson.dependencies) ||
      (packageJson.devDependencies && 'vite' in packageJson.devDependencies)

    if (hasVite) {
      return 5173 // Vite's default port
    }

    return 3000
  } catch (error) {
    console.error('Error detecting port from repository:', error)
    return 3000
  }
}
