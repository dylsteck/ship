import { cn } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown-lazy'

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
  jobs?: GitCheckJob[]
}

interface GitCheckJob {
  name: string
  state: 'pending' | 'success' | 'failure' | 'error' | 'neutral' | 'unknown'
  status?: string
  conclusion?: string
  url?: string
  startedAt?: string
  completedAt?: string
}

interface GitPullRequest {
  number: number
  url: string
  draft: boolean
  title?: string
  body?: string
  merged?: boolean
  state?: string
  headBranch?: string
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

export function CommitsContent({ commits, repoUrl }: { commits?: GitCommit[]; repoUrl?: string }) {
  if (!commits || commits.length === 0) {
    return <EmptyState title="No local commits yet" detail="Commits ahead of the base branch will appear here." />
  }
  return (
    <div className="h-full overflow-y-auto divide-y divide-white/10">
      {commits.map((commit) => (
        <a
          key={commit.hash}
          href={commitUrl(repoUrl, commit.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-3 transition-colors hover:bg-white/[0.04]"
        >
          <div className="truncate text-sm text-zinc-200">{commit.subject}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-mono text-zinc-400">{commit.shortHash}</span>
            <span>{commit.authorName}</span>
            {commit.authoredAt && <span>{new Date(commit.authoredAt).toLocaleString()}</span>}
          </div>
        </a>
      ))}
    </div>
  )
}

export function PRContent({ pr, checks }: { pr?: GitPullRequest | null; checks?: GitChecks }) {
  if (!pr) return <EmptyState title="No pull request yet" detail="PR details and CI status will appear after a PR exists." />
  return (
    <div className="h-full space-y-3 overflow-y-auto p-3">
      <section className="rounded-md border border-white/10 bg-white/[0.025] p-3">
        <div className="mb-2 text-xs font-medium text-zinc-400">Description</div>
        {pr.body?.trim() ? (
          <Markdown content={pr.body} className="text-[12.5px] text-zinc-300 [&_*]:border-white/10 [&_code]:bg-white/[0.08]" />
        ) : (
          <div className="text-xs text-zinc-500">No PR description yet.</div>
        )}
      </section>
      <CheckSummary checks={checks} />
    </div>
  )
}

function CheckSummary({ checks }: { checks?: GitChecks }) {
  if (!checks) return <div className="rounded-md border border-white/10 p-3 text-xs text-zinc-500">No CI status available.</div>
  const jobs = checks.jobs ?? []
  const skipped = jobs.filter(isSkippedJob).length
  const ratioTotal = Math.max(checks.total - skipped, 0)
  const ratioSuccess = Math.max(checks.success - skipped, 0)
  const completeLabel = ratioTotal > 0 ? `${ratioSuccess}/${ratioTotal}` : '0/0'
  return (
    <details className="group rounded-md border border-white/10 bg-white/[0.025] p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-zinc-200">
        <span>CI status</span>
        <span className={cn('font-mono', checkStateClass(checks.state))}>{completeLabel}</span>
      </summary>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
        <span>{checks.total} total</span>
        <span>{checks.pending} pending</span>
        {skipped > 0 && <span>{skipped} skipped</span>}
        <span>{ratioSuccess} success</span>
        <span>{checks.failure} failed</span>
      </div>
      {jobs.length > 0 && (
        <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-md border border-white/[0.07]">
          {jobs.map((job) => (
            <CheckJobRow key={`${job.name}-${job.url ?? job.status ?? job.conclusion ?? job.state}`} job={job} />
          ))}
        </div>
      )}
    </details>
  )
}

function CheckJobRow({ job }: { job: GitCheckJob }) {
  const skipped = isSkippedJob(job)
  const label = skipped ? 'skipped' : job.conclusion || job.status || job.state
  const content = (
    <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
      <span className={cn('size-2 rounded-full', skipped ? 'bg-zinc-500' : checkDotClass(job.state))} />
      <span className="min-w-0 flex-1 truncate text-zinc-300">{job.name}</span>
      <span className={cn('shrink-0 capitalize', skipped ? 'text-zinc-500' : checkStateClass(job.state))}>{label}</span>
    </div>
  )

  if (!job.url) return content
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-colors hover:bg-white/[0.04]"
      title="Open check on GitHub"
    >
      {content}
    </a>
  )
}

function isSkippedJob(job: GitCheckJob): boolean {
  return job.conclusion?.toLowerCase() === 'skipped' || job.status?.toLowerCase() === 'skipped'
}

function checkStateClass(state: GitChecks['state']): string {
  if (state === 'success') return 'text-emerald-400'
  if (state === 'failure' || state === 'error') return 'text-red-400'
  if (state === 'pending') return 'text-amber-300'
  return 'text-zinc-500'
}

function checkDotClass(state: GitChecks['state']): string {
  if (state === 'success') return 'bg-emerald-400'
  if (state === 'failure' || state === 'error') return 'bg-red-400'
  if (state === 'pending') return 'bg-amber-300'
  return 'bg-zinc-500'
}

function commitUrl(repoUrl: string | undefined, hash: string): string | undefined {
  if (!repoUrl) return undefined
  return `${repoUrl.replace(/\.git$/, '')}/commit/${hash}`
}
