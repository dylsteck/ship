/** Git and pull-request metadata helpers for Session DO. */

export interface SessionGitMetaHost {
  getSessionMeta(): Promise<Record<string, string>>
  setSessionMeta(key: string, value: string): Promise<void>
}

export async function setBranchName(host: SessionGitMetaHost, name: string): Promise<void> {
  await host.setSessionMeta('branch_name', name)
  await host.setSessionMeta('current_branch', name)
}

export async function getBranchName(host: SessionGitMetaHost): Promise<string | null> {
  const meta = await host.getSessionMeta()
  return meta['branch_name'] || meta['current_branch'] || null
}

export async function markFirstCommit(host: SessionGitMetaHost): Promise<boolean> {
  const meta = await host.getSessionMeta()
  const wasFirstCommit = !meta['first_commit_done']
  if (wasFirstCommit) {
    await host.setSessionMeta('first_commit_done', 'true')
  }
  return wasFirstCommit
}

export async function setPullRequest(
  host: SessionGitMetaHost,
  number: number,
  url: string,
  draft: boolean,
): Promise<void> {
  await host.setSessionMeta('pr_number', number.toString())
  await host.setSessionMeta('pr_url', url)
  await host.setSessionMeta('pr_draft', draft.toString())
}

export async function getPullRequest(
  host: SessionGitMetaHost,
): Promise<{ number: number; url: string; draft: boolean } | null> {
  const meta = await host.getSessionMeta()
  if (!meta['pr_number']) return null
  return {
    number: parseInt(meta['pr_number']),
    url: meta['pr_url'],
    draft: meta['pr_draft'] === 'true',
  }
}

export async function markReadyForReview(host: SessionGitMetaHost): Promise<void> {
  await host.setSessionMeta('pr_draft', 'false')
}

export async function setRepoUrl(host: SessionGitMetaHost, url: string): Promise<void> {
  await host.setSessionMeta('repo_url', url)
}

export async function getRepoUrl(host: SessionGitMetaHost): Promise<string | null> {
  const meta = await host.getSessionMeta()
  return meta['repo_url'] || null
}
