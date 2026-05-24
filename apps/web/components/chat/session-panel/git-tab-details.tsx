import { cn } from '@ship/ui'

interface GitCommit {
  hash: string
  shortHash: string
  subject: string
  authorName: string
  authoredAt: string
}

interface GitChecks {
  state: 'pending' | 'success' | 'failure' | 'error' | 'neutral' | 'unknown'
  total: number
  pending: number
  success: number
  failure: number
}

interface GitPullRequest {
  number: number
  url: string
  draft: boolean
  title?: string
  state?: string
  baseBranch?: string
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[360px] flex-1 items-center justify-center px-8 text-center">
      <div>
        <div className="text-sm text-zinc-300">{title}</div>
        <div className="mt-2 text-xs text-zinc-500">{detail}</div>
      </div>
    </div>
  )
}

export function CommitsContent({ commits }: { commits?: GitCommit[] }) {
  if (!commits || commits.length === 0) {
    return <EmptyState title="No local commits yet" detail="Commits ahead of the base branch will appear here." />
  }
  return (
    <div className="h-full overflow-y-auto divide-y divide-white/10">
      {commits.map((commit) => (
        <div key={commit.hash} className="px-3 py-3">
          <div className="truncate text-sm text-zinc-200">{commit.subject}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-mono text-zinc-400">{commit.shortHash}</span>
            <span>{commit.authorName}</span>
            {commit.authoredAt && <span>{new Date(commit.authoredAt).toLocaleString()}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PRContent({ pr, checks }: { pr?: GitPullRequest | null; checks?: GitChecks }) {
  if (!pr) return <EmptyState title="No pull request yet" detail="PR details and CI status will appear after a PR exists." />
  return (
    <div className="h-full space-y-3 overflow-y-auto p-3">
      <a
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md border border-white/10 bg-white/[0.04] p-3 hover:bg-white/[0.07]"
      >
        <div className="text-xs text-zinc-500">PR #{pr.number}</div>
        <div className="mt-1 text-sm text-zinc-100">{pr.title || 'Untitled pull request'}</div>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <span>{pr.draft ? 'Draft' : pr.state || 'Open'}</span>
          {pr.baseBranch && <span>into {pr.baseBranch}</span>}
        </div>
      </a>
      <CheckSummary checks={checks} />
    </div>
  )
}

function CheckSummary({ checks }: { checks?: GitChecks }) {
  if (!checks) return <div className="rounded-md border border-white/10 p-3 text-xs text-zinc-500">No CI status available.</div>
  return (
    <div className="rounded-md border border-white/10 p-3">
      <div className="flex items-center justify-between text-sm text-zinc-200">
        <span>CI status</span>
        <span
          className={cn(
            'capitalize',
            checks.state === 'success' && 'text-emerald-400',
            checks.state === 'failure' && 'text-red-400',
            checks.state === 'pending' && 'text-amber-300',
          )}
        >
          {checks.state}
        </span>
      </div>
      <div className="mt-2 flex gap-3 font-mono text-[11px] text-zinc-500">
        <span>{checks.total} total</span>
        <span>{checks.pending} pending</span>
        <span>{checks.success} success</span>
        <span>{checks.failure} failed</span>
      </div>
    </div>
  )
}
