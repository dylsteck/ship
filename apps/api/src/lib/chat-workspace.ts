/**
 * Workspace setup for a chat turn.
 *
 * - Waits for sandbox provisioning if a session row indicates one is in flight.
 * - Clones the linked GitHub repo on first use, reusing the existing
 *   credential-brokering logic in `lib/git-workflow.ts`.
 * - Returns the workspace handle as a {@link Sandbox} from `@ship/sandbox`.
 *
 * @packageDocumentation
 */

import { connectSandbox, type Sandbox, type SandboxState } from '@ship/sandbox'
import type { Env } from '../env.d'
import { Sandbox as E2BSandbox } from './e2b'
import { cloneGitHubRepoWithStrategies, generateBranchName } from './git-workflow'
import { writeStatus, type SSEWriter } from './chat-stream-helpers'

/** Maximum wait while the provisioner spins up a fresh sandbox. */
const SANDBOX_PROVISION_WAIT_MS = 30_000
const SANDBOX_POLL_INTERVAL_MS = 1_000

/** All workspace data needed to run a chat turn. */
export interface ResolvedWorkspace {
  /** Live sandbox handle (already extended in timeout). */
  sandbox: Sandbox
  /** Sandbox identity for persistence. */
  sandboxState: SandboxState
  /** Absolute path to the workspace root inside the VM. */
  workingDirectory: string
  /** Current git branch (if cloned). */
  currentBranch?: string
  /** Repo owner (when linked to GitHub). */
  repoOwner?: string
  /** Repo name (when linked to GitHub). */
  repoName?: string
}

interface PrepareWorkspaceInput {
  env: Env
  sessionId: string
  /** Initial DO meta read. */
  meta: Record<string, string>
  /** DO stub for follow-up meta reads/writes. */
  stub: { fetch: typeof fetch }
  /** GitHub OAuth token for cloning private repos. */
  githubToken?: string
  /** Git author info applied during initial clone. */
  gitUser: { name: string; email: string }
  /** First user message (used to seed the branch name). */
  userPrompt: string
  /** SSE writer for status updates. */
  stream: SSEWriter
}

/** Outcome of {@link prepareWorkspace}. */
export type PrepareWorkspaceResult =
  | { ok: true; workspace: ResolvedWorkspace }
  | { ok: false; error: { code: string; message: string; retryable?: boolean } }

const DEFAULT_WORKING_DIRECTORY = '/home/user'

/**
 * Wait for sandbox provisioning, clone the linked repo if needed, and
 * return a {@link ResolvedWorkspace} ready to drive an agent turn.
 */
export async function prepareWorkspace(input: PrepareWorkspaceInput): Promise<PrepareWorkspaceResult> {
  const sandboxResult = await ensureSandboxId(input)
  if (!sandboxResult.ok) return sandboxResult
  const sandboxId = sandboxResult.sandboxId

  const repoMeta = pickRepoMeta(input.meta)
  const e2b = await E2BSandbox.connect(sandboxId, { apiKey: input.env.E2B_API_KEY })
  await e2b.setTimeout(10 * 60 * 1000)

  if (repoMeta && !input.meta['repo_url']) {
    const cloneResult = await cloneRepoOrError(input, e2b, repoMeta, sandboxId)
    if (!cloneResult.ok) return cloneResult
  }

  const workingDirectory =
    input.meta['repo_url'] || repoMeta ? `${DEFAULT_WORKING_DIRECTORY}/repo` : DEFAULT_WORKING_DIRECTORY
  const sandbox = await connectSandbox({ type: 'e2b', sandboxId }, { apiKey: input.env.E2B_API_KEY, workingDirectory })

  const branchName = input.meta['current_branch'] || repoMeta?.branchName
  return {
    ok: true,
    workspace: {
      sandbox,
      sandboxState: { type: 'e2b', sandboxId },
      workingDirectory,
      ...(branchName ? { currentBranch: branchName } : {}),
      ...(repoMeta?.owner ? { repoOwner: repoMeta.owner } : {}),
      ...(repoMeta?.name ? { repoName: repoMeta.name } : {}),
    },
  }
}

interface EnsureSandboxResult {
  ok: true
  sandboxId: string
}

async function ensureSandboxId(
  input: PrepareWorkspaceInput,
): Promise<EnsureSandboxResult | { ok: false; error: { code: string; message: string; retryable?: boolean } }> {
  if (input.meta['sandbox_id']) return { ok: true, sandboxId: input.meta['sandbox_id'] }
  if (input.meta['sandbox_status'] === 'error') {
    return {
      ok: false,
      error: {
        code: 'sandbox_provisioning_failed',
        message:
          input.meta['sandbox_error'] ||
          'Sandbox provisioning failed. Try refreshing the page or starting a new session.',
        retryable: true,
      },
    }
  }

  await writeStatus(input.stream, 'provisioning', 'Provisioning sandbox...')
  const startedAt = Date.now()
  while (Date.now() - startedAt < SANDBOX_PROVISION_WAIT_MS) {
    await delay(SANDBOX_POLL_INTERVAL_MS)
    const polled = await fetchMeta(input.stub)
    if (polled['sandbox_id']) {
      input.meta = polled
      return { ok: true, sandboxId: polled['sandbox_id'] }
    }
    if (polled['sandbox_status'] === 'error') {
      return {
        ok: false,
        error: {
          code: 'sandbox_provisioning_failed',
          message: polled['sandbox_error'] || 'Sandbox provisioning failed.',
          retryable: true,
        },
      }
    }
  }

  return {
    ok: false,
    error: {
      code: 'sandbox_provisioning_timeout',
      message: 'Timed out waiting for the sandbox to provision. Please try again.',
      retryable: true,
    },
  }
}

interface RepoMeta {
  owner: string
  name: string
  branchName?: string
  baseBranch: string
}

function pickRepoMeta(meta: Record<string, string>): RepoMeta | undefined {
  const owner = meta['repoOwner'] || meta['repo_owner']
  const name = meta['repoName'] || meta['repo_name']
  if (!owner || !name) return undefined
  return {
    owner,
    name,
    ...(meta['current_branch'] ? { branchName: meta['current_branch'] } : {}),
    baseBranch: meta['base_branch'] || 'main',
  }
}

async function cloneRepoOrError(
  input: PrepareWorkspaceInput,
  e2b: E2BSandbox,
  repo: RepoMeta,
  sandboxId: string,
): Promise<PrepareWorkspaceResult> {
  if (!input.githubToken) {
    return {
      ok: false,
      error: {
        code: 'github_not_connected',
        message: 'GitHub is not connected. Connect GitHub in Settings to clone this repository.',
        retryable: false,
      },
    }
  }

  await writeStatus(input.stream, 'cloning', `Cloning ${repo.owner}/${repo.name}...`)
  const repoPath = `${DEFAULT_WORKING_DIRECTORY}/repo`
  const taskSlug = input.userPrompt.trim().slice(0, 80) || 'agent-task'
  const branchName = generateBranchName(taskSlug, input.sessionId)
  const repoUrl = `https://github.com/${repo.owner}/${repo.name}.git`

  try {
    await cloneGitHubRepoWithStrategies(e2b, repo.owner, repo.name, repoPath, input.githubToken, {
      timeoutMs: 120_000,
      depth: 1,
      singleBranch: true,
    })
  } catch (cloneError) {
    return {
      ok: false,
      error: {
        code: 'clone_failed',
        message: cloneError instanceof Error ? cloneError.message : 'Failed to clone repository.',
        retryable: false,
      },
    }
  }

  await runQuiet(e2b, `cd ${repoPath} && git config user.name "${escape(input.gitUser.name)}"`)
  await runQuiet(e2b, `cd ${repoPath} && git config user.email "${escape(input.gitUser.email)}"`)
  await runQuiet(e2b, `cd ${repoPath} && git checkout ${repo.baseBranch} || true`)
  await runQuiet(e2b, `cd ${repoPath} && git checkout -b ${branchName}`)

  await input.stub.fetch(
    new Request('https://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_url: repoUrl,
        current_branch: branchName,
        branch_name: branchName,
        base_branch: repo.baseBranch,
        repo_path: repoPath,
      }),
    }),
  )

  console.log(`[chat:${input.sessionId}] Repository cloned successfully (sandbox=${sandboxId})`)
  await writeStatus(input.stream, 'repo-ready', `Repository ready. Branch: ${branchName}`)

  return {
    ok: true,
    workspace: {
      sandbox: await connectSandbox(
        { type: 'e2b', sandboxId },
        { apiKey: input.env.E2B_API_KEY, workingDirectory: repoPath },
      ),
      sandboxState: { type: 'e2b', sandboxId },
      workingDirectory: repoPath,
      currentBranch: branchName,
      repoOwner: repo.owner,
      repoName: repo.name,
    },
  }
}

async function runQuiet(e2b: E2BSandbox, command: string): Promise<void> {
  try {
    await e2b.commands.run(command)
  } catch {
    // Best-effort — ignore non-zero exits in setup steps.
  }
}

function escape(value: string): string {
  return value.replace(/"/g, '\\"')
}

async function fetchMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const res = await stub.fetch(new Request('https://do/meta'))
  return (await res.json()) as Record<string, string>
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
