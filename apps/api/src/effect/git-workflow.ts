/**
 * Effect-native git workflow operations for sandbox repositories.
 *
 * @packageDocumentation
 */

import { Context, Effect, Layer } from 'effect'

import type { ComputeCommandSandbox } from '../lib/sandbox-command'
import { SandboxCommands } from './sandbox-commands'
import { GitWorkflowEffectError } from './errors'

/** Options used when cloning GitHub repositories. */
export interface CloneGitHubRepoOptions {
  readonly timeoutMs?: number
  readonly depth?: number
  readonly singleBranch?: boolean
}

/** Git author identity for commits. */
export interface GitUser {
  readonly name: string
  readonly email: string
}

/** Effect service for git operations inside a sandbox repository. */
export interface GitWorkflowService {
  readonly cloneGitHubRepoWithStrategies: (
    sandbox: ComputeCommandSandbox,
    owner: string,
    repo: string,
    destPath: string,
    token: string,
    options?: CloneGitHubRepoOptions,
  ) => Effect.Effect<void, GitWorkflowEffectError, SandboxCommands>
  readonly cloneRepo: (
    sandbox: ComputeCommandSandbox,
    repoUrl: string,
    token: string,
  ) => Effect.Effect<string, GitWorkflowEffectError, SandboxCommands>
  readonly createBranch: (
    sandbox: ComputeCommandSandbox,
    branchName: string,
    repoPath?: string,
  ) => Effect.Effect<void, GitWorkflowEffectError, SandboxCommands>
  readonly configureGitUser: (
    sandbox: ComputeCommandSandbox,
    user: GitUser,
    repoPath?: string,
  ) => Effect.Effect<void, GitWorkflowEffectError, SandboxCommands>
  readonly commitChanges: (
    sandbox: ComputeCommandSandbox,
    message: string,
    user: GitUser,
    repoPath?: string,
  ) => Effect.Effect<string, GitWorkflowEffectError, SandboxCommands>
  readonly pushBranch: (
    sandbox: ComputeCommandSandbox,
    branchName: string,
    token: string,
    repoPath?: string,
  ) => Effect.Effect<void, GitWorkflowEffectError, SandboxCommands>
}

/** Injectable {@link GitWorkflowService}. */
export class GitWorkflow extends Context.Tag('GitWorkflow')<GitWorkflow, GitWorkflowService>() {}

function parseGitHubHttpsRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const withGit = repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`
    const u = new URL(withGit)
    if (u.hostname !== 'github.com') return null
    const seg = u.pathname.replace(/^\//, '').replace(/\.git$/i, '').split('/').filter(Boolean)
    if (seg.length < 2) return null
    return { owner: seg[0]!, repo: seg[1]! }
  } catch {
    return null
  }
}

function workflowError(input: {
  operation: string
  code: string
  message: string
  command?: string
  cause?: unknown
}): GitWorkflowEffectError {
  return new GitWorkflowEffectError({
    operation: input.operation,
    code: input.code,
    ...(input.command ? { command: input.command } : {}),
    messageOverride: input.message,
    ...(input.cause ? { cause: input.cause } : {}),
  })
}

const service: GitWorkflowService = {
  cloneGitHubRepoWithStrategies: (sandbox, owner, repo, destPath, token, options) =>
    Effect.gen(function* () {
      const commands = yield* SandboxCommands
      const depth = options?.depth ?? 1
      const singleBranch = options?.singleBranch !== false
      const timeoutMs = options?.timeoutMs ?? 120_000
      const singleFlag = singleBranch ? '--single-branch ' : ''
      const o = owner.trim()
      const r = repo.replace(/\.git$/i, '').trim()

      const attempts: { name: string; cmd: string }[] = [
        {
          name: 'x-access-token-in-url',
          cmd: `GIT_TERMINAL_PROMPT=0 git clone --depth ${depth} ${singleFlag}"https://x-access-token:\${GITHUB_CLONE_TOKEN}@github.com/${o}/${r}.git" "${destPath}"`,
        },
        {
          name: 'oauth2-in-url',
          cmd: `GIT_TERMINAL_PROMPT=0 git clone --depth ${depth} ${singleFlag}"https://oauth2:\${GITHUB_CLONE_TOKEN}@github.com/${o}/${r}.git" "${destPath}"`,
        },
        {
          name: 'token-userinfo-github',
          cmd: `GIT_TERMINAL_PROMPT=0 git clone --depth ${depth} ${singleFlag}"https://\${GITHUB_CLONE_TOKEN}@github.com/${o}/${r}.git" "${destPath}"`,
        },
        {
          name: 'bearer-extraHeader',
          cmd: `GIT_TERMINAL_PROMPT=0 git -c http.extraHeader="Authorization: Bearer \${GITHUB_CLONE_TOKEN}" clone --depth ${depth} ${singleFlag}"https://github.com/${o}/${r}.git" "${destPath}"`,
        },
      ]

      let lastErr: unknown
      for (const attempt of attempts) {
        const result = yield* Effect.either(
          commands.runSuccessful(sandbox, attempt.cmd, {
            timeoutMs,
            envs: { GITHUB_CLONE_TOKEN: token },
          }),
        )
        if (result._tag === 'Right') {
          console.log(`[git-workflow] GitHub clone succeeded (${attempt.name}) ${o}/${r}`)
          return
        }
        lastErr = result.left
        console.warn(
          `[git-workflow] GitHub clone attempt ${attempt.name} failed:`,
          result.left.message,
        )
        yield* commands.run(sandbox, `rm -rf "${destPath}"`).pipe(Effect.catchAll(() => Effect.void))
      }

      return yield* Effect.fail(
        workflowError({
          operation: 'cloneGitHubRepoWithStrategies',
          code: 'CLONE_FAILED',
          message: lastErr instanceof Error ? lastErr.message : String(lastErr),
          cause: lastErr,
        }),
      )
    }),

  cloneRepo: (sandbox, repoUrl, token) =>
    Effect.gen(function* () {
      const commands = yield* SandboxCommands
      const repoPath = '/home/user/repo'
      const gh = parseGitHubHttpsRepo(repoUrl)
      if (gh) {
        yield* service.cloneGitHubRepoWithStrategies(sandbox, gh.owner, gh.repo, repoPath, token)
        return repoPath
      }

      const url = repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`
      const command = `GIT_TERMINAL_PROMPT=0 git -c http.extraHeader="Authorization: Bearer \${GITHUB_CLONE_TOKEN}" clone ${url} ${repoPath}`
      yield* commands
        .runSuccessful(sandbox, command, { envs: { GITHUB_CLONE_TOKEN: token } })
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'cloneRepo',
              code: 'CLONE_FAILED',
              message: `Git clone failed: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: `git clone`,
              cause: error,
            }),
          ),
        )
      return repoPath
    }).pipe(
      Effect.mapError((error) =>
        error.message.startsWith('Failed to clone repository:')
          ? error
          : workflowError({
              operation: 'cloneRepo',
              code: 'CLONE_FAILED',
              message: `Failed to clone repository: ${error.message}`,
              cause: error,
            }),
      ),
    ),

  createBranch: (sandbox, branchName, repoPath = '/home/user/repo') =>
    Effect.gen(function* () {
      const commands = yield* SandboxCommands
      const check = yield* Effect.either(
        commands.runSuccessful(sandbox, `cd ${repoPath} && git rev-parse --verify ${branchName} 2>/dev/null`),
      )

      if (check._tag === 'Right') {
        yield* commands
          .runSuccessful(sandbox, `cd ${repoPath} && git checkout ${branchName}`)
          .pipe(
            Effect.mapError((error) =>
              workflowError({
                operation: 'createBranch',
                code: 'CHECKOUT_FAILED',
                message: `Failed to checkout existing branch: ${error.message.replace(/^Sandbox command failed: /, '')}`,
                command: `git checkout ${branchName}`,
                cause: error,
              }),
            ),
          )
        return
      }

      yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git checkout -b ${branchName}`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'createBranch',
              code: 'BRANCH_CREATE_FAILED',
              message: `Failed to create branch: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: `git checkout -b ${branchName}`,
              cause: error,
            }),
          ),
        )
    }).pipe(
      Effect.mapError((error) =>
        error.code === 'CHECKOUT_FAILED' || error.code === 'BRANCH_CREATE_FAILED'
          ? error
          : workflowError({
              operation: 'createBranch',
              code: 'BRANCH_CREATE_FAILED',
              message: `Failed to create branch: ${error.message}`,
              cause: error,
            }),
      ),
    ),

  configureGitUser: (sandbox, user, repoPath = '/home/user/repo') =>
    Effect.gen(function* () {
      const commands = yield* SandboxCommands
      yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git config user.name "${user.name}"`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'configureGitUser',
              code: 'CONFIG_FAILED',
              message: `Failed to set git user.name: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: 'git config user.name',
              cause: error,
            }),
          ),
        )
      yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git config user.email "${user.email}"`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'configureGitUser',
              code: 'CONFIG_FAILED',
              message: `Failed to set git user.email: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: 'git config user.email',
              cause: error,
            }),
          ),
        )
    }).pipe(
      Effect.mapError((error) =>
        error.code === 'CONFIG_FAILED'
          ? error
          : workflowError({
              operation: 'configureGitUser',
              code: 'CONFIG_FAILED',
              message: `Failed to configure git user: ${error.message}`,
              cause: error,
            }),
      ),
    ),

  commitChanges: (sandbox, message, user, repoPath = '/home/user/repo') =>
    Effect.gen(function* () {
      const commands = yield* SandboxCommands
      yield* service.configureGitUser(sandbox, user, repoPath)

      const statusResult = yield* commands
        .run(sandbox, `cd ${repoPath} && git status --porcelain`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'commitChanges',
              code: 'COMMIT_FAILED',
              message: `Failed to commit changes: ${error.message}`,
              cause: error,
            }),
          ),
        )
      if (!statusResult.stdout || statusResult.stdout.trim() === '') {
        return yield* Effect.fail(
          workflowError({
            operation: 'commitChanges',
            code: 'NO_CHANGES',
            message: 'No changes to commit',
          }),
        )
      }

      yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git add -A`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'commitChanges',
              code: 'ADD_FAILED',
              message: `Failed to stage changes: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: 'git add -A',
              cause: error,
            }),
          ),
        )

      const escapedMessage = message.replace(/"/g, '\\"')
      yield* commands
        .runSuccessful(
          sandbox,
          `cd ${repoPath} && git commit -m "${escapedMessage}" -m "Co-Authored-By: Ship <shipagent@dylansteck.com>"`,
        )
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'commitChanges',
              code: 'COMMIT_FAILED',
              message: `Failed to commit: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: 'git commit',
              cause: error,
            }),
          ),
        )

      const hashResult = yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git rev-parse --short HEAD`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'commitChanges',
              code: 'HASH_FAILED',
              message: 'Failed to get commit hash',
              command: 'git rev-parse',
              cause: error,
            }),
          ),
        )
      if (!hashResult.stdout) {
        return yield* Effect.fail(
          workflowError({
            operation: 'commitChanges',
            code: 'HASH_FAILED',
            message: 'Failed to get commit hash',
            command: 'git rev-parse',
          }),
        )
      }

      return hashResult.stdout.trim()
    }).pipe(
      Effect.mapError((error) =>
        error.code
          ? error
          : workflowError({
              operation: 'commitChanges',
              code: 'COMMIT_FAILED',
              message: `Failed to commit changes: ${error.message}`,
              cause: error,
            }),
      ),
    ),

  pushBranch: (sandbox, branchName, token, repoPath = '/home/user/repo') =>
    Effect.gen(function* () {
      const commands = yield* SandboxCommands
      const remoteResult = yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git remote get-url origin`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'pushBranch',
              code: 'REMOTE_FAILED',
              message: 'Failed to get remote URL',
              command: 'git remote get-url',
              cause: error,
            }),
          ),
        )
      if (!remoteResult.stdout) {
        return yield* Effect.fail(
          workflowError({
            operation: 'pushBranch',
            code: 'REMOTE_FAILED',
            message: 'Failed to get remote URL',
            command: 'git remote get-url',
          }),
        )
      }

      const remoteUrl = remoteResult.stdout.trim()
      let authUrl = remoteUrl
      if (remoteUrl.startsWith('https://github.com/')) {
        const enc = encodeURIComponent(token)
        authUrl = remoteUrl.replace('https://github.com/', `https://x-access-token:${enc}@github.com/`)
      } else if (remoteUrl.startsWith('https://') && !remoteUrl.includes('@')) {
        const enc = encodeURIComponent(token)
        authUrl = remoteUrl.replace('https://', `https://x-access-token:${enc}@`)
      }

      yield* commands
        .run(sandbox, `cd ${repoPath} && git remote set-url origin "${authUrl}"`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'pushBranch',
              code: 'PUSH_FAILED',
              message: `Failed to push branch: ${error.message}`,
              cause: error,
            }),
          ),
        )
      yield* commands
        .runSuccessful(sandbox, `cd ${repoPath} && git push -u origin ${branchName}`)
        .pipe(
          Effect.mapError((error) =>
            workflowError({
              operation: 'pushBranch',
              code: 'PUSH_FAILED',
              message: `Failed to push branch: ${error.message.replace(/^Sandbox command failed: /, '')}`,
              command: `git push origin ${branchName}`,
              cause: error,
            }),
          ),
          Effect.ensuring(
            commands
              .run(sandbox, `cd ${repoPath} && git remote set-url origin "${remoteUrl}"`)
              .pipe(Effect.catchAll(() => Effect.void)),
          ),
        )
    }).pipe(
      Effect.mapError((error) =>
        error.code
          ? error
          : workflowError({
              operation: 'pushBranch',
              code: 'PUSH_FAILED',
              message: `Failed to push branch: ${error.message}`,
              cause: error,
            }),
      ),
    ),
}

/** Live git workflow implementation. */
export const GitWorkflowLive = Layer.succeed(GitWorkflow, service)
