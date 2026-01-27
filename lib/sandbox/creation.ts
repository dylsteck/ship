import { Sandbox } from '@vercel/sandbox'
import { Writable } from 'stream'
import { validateEnvironmentVariables, createAuthenticatedRepoUrl } from './config'
import { runCommandInSandbox, runInProject, PROJECT_DIR } from './commands'
import { generateId } from '@/lib/utils/id'
import { SandboxConfig, SandboxResult } from './types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { detectPackageManager, installDependencies } from './package-manager'
import { registerSandbox } from './sandbox-registry'

async function runAndLogCommand(sandbox: Sandbox, command: string, args: string[], logger: TaskLogger, cwd?: string) {
  const escapeArg = (arg: string) => `'${arg.replace(/'/g, "'\\''")}'`
  const fullCommand = args.length > 0 ? `${command} ${args.map(escapeArg).join(' ')}` : command
  const redactedCommand = redactSensitiveInfo(fullCommand)

  await logger.command(redactedCommand)

  let result
  if (cwd) {
    const cdCommand = `cd ${cwd} && ${fullCommand}`
    result = await runCommandInSandbox(sandbox, 'sh', ['-c', cdCommand])
  } else {
    result = await runCommandInSandbox(sandbox, command, args)
  }

  if (result && result.output && result.output.trim()) {
    const redactedOutput = redactSensitiveInfo(result.output.trim())
    await logger.info(redactedOutput)
  }

  if (result && !result.success && result.error) {
    const redactedError = redactSensitiveInfo(result.error)
    await logger.error(redactedError)
  }

  return result
}

export async function createSandbox(config: SandboxConfig, logger: TaskLogger): Promise<SandboxResult> {
  try {
    await logger.info('Processing repository URL')

    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info('Task was cancelled before sandbox creation')
      return { success: false, cancelled: true }
    }

    if (config.onProgress) {
      await config.onProgress(20, 'Validating environment variables...')
    }

    const envValidation = validateEnvironmentVariables(config.selectedAgent, config.githubToken, config.apiKeys)
    if (!envValidation.valid) {
      throw new Error(envValidation.error!)
    }
    await logger.info('Environment variables validated')

    const authenticatedRepoUrl = createAuthenticatedRepoUrl(config.repoUrl, config.githubToken)
    await logger.info('Added GitHub authentication to repository URL')

    const timeoutMs = config.timeout ? parseInt(config.timeout.replace(/\D/g, '')) * 60 * 1000 : 60 * 60 * 1000
    const defaultPorts = config.ports || [3000, 5173]

    const sandboxConfig = {
      teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
      projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
      token: process.env.SANDBOX_VERCEL_TOKEN!,
      timeout: timeoutMs,
      ports: defaultPorts,
      runtime: config.runtime || 'node22',
      resources: { vcpus: config.resources?.vcpus || 4 },
    }

    if (config.onProgress) {
      await config.onProgress(25, 'Validating configuration...')
    }

    let sandbox: Sandbox
    try {
      sandbox = await Sandbox.create(sandboxConfig)
      await logger.info('Sandbox created successfully')

      registerSandbox(config.taskId, sandbox, config.keepAlive || false)

      if (config.onCancellationCheck && (await config.onCancellationCheck())) {
        await logger.info('Task was cancelled after sandbox creation')
        return { success: false, cancelled: true }
      }

      await logger.info('Cloning repository to project directory...')

      const mkdirResult = await runCommandInSandbox(sandbox, 'mkdir', ['-p', PROJECT_DIR])
      if (!mkdirResult.success) {
        throw new Error('Failed to create project directory')
      }

      const cloneResult = await runCommandInSandbox(sandbox, 'git', [
        'clone',
        '--depth',
        '1',
        authenticatedRepoUrl,
        PROJECT_DIR,
      ])

      if (!cloneResult.success) {
        await logger.error('Failed to clone repository')
        throw new Error('Failed to clone repository to project directory')
      }

      await logger.info('Repository cloned successfully')

      if (config.onProgress) {
        await config.onProgress(30, 'Repository cloned, installing dependencies...')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      await logger.error('Sandbox creation failed')
      throw error
    }

    // Install project dependencies
    if (config.installDependencies !== false) {
      const packageJsonCheck = await runInProject(sandbox, 'test', ['-f', 'package.json'])

      if (packageJsonCheck.success) {
        await logger.info('package.json found, installing Node.js dependencies...')
        const packageManager = await detectPackageManager(sandbox, logger)

        if (config.onProgress) {
          await config.onProgress(35, 'Installing Node.js dependencies...')
        }

        const installResult = await installDependencies(sandbox, packageManager, logger)
        if (!installResult.success) {
          await logger.info('Warning: Failed to install Node.js dependencies, but continuing with sandbox setup')
        }
      }
    }

    // Get domain
    let domain: string | undefined = sandbox.domain(3000)

    // Configure Git user
    const gitName = config.gitAuthorName || 'Coding Agent'
    const gitEmail = config.gitAuthorEmail || 'agent@example.com'
    await runInProject(sandbox, 'git', ['config', 'user.name', gitName])
    await runInProject(sandbox, 'git', ['config', 'user.email', gitEmail])

    // Verify Git repository
    const gitRepoCheck = await runInProject(sandbox, 'git', ['rev-parse', '--git-dir'])
    if (!gitRepoCheck.success) {
      await logger.info('Not in a Git repository, initializing...')
      await runInProject(sandbox, 'git', ['init'])
      await logger.info('Git repository initialized')
    }

    let branchName: string

    if (config.preDeterminedBranchName) {
      await logger.info('Using pre-determined branch name')
      
      const branchExistsLocal = await runInProject(sandbox, 'git', [
        'show-ref',
        '--verify',
        '--quiet',
        `refs/heads/${config.preDeterminedBranchName}`,
      ])

      if (branchExistsLocal.success) {
        await runAndLogCommand(sandbox, 'git', ['checkout', config.preDeterminedBranchName], logger, PROJECT_DIR)
        branchName = config.preDeterminedBranchName
      } else {
        const branchExistsRemote = await runInProject(sandbox, 'git', [
          'ls-remote',
          '--heads',
          'origin',
          config.preDeterminedBranchName,
        ])

        if (branchExistsRemote.success && branchExistsRemote.output?.trim()) {
          await runInProject(sandbox, 'git', ['fetch', 'origin'])
          await runAndLogCommand(
            sandbox,
            'git',
            ['checkout', '-b', config.preDeterminedBranchName, '--track', `origin/${config.preDeterminedBranchName}`],
            logger,
            PROJECT_DIR,
          )
          branchName = config.preDeterminedBranchName
        } else {
          await runAndLogCommand(sandbox, 'git', ['checkout', '-b', config.preDeterminedBranchName], logger, PROJECT_DIR)
          branchName = config.preDeterminedBranchName
        }
      }
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const suffix = generateId()
      branchName = `agent/${timestamp}-${suffix}`

      await logger.info('No predetermined branch name, using timestamp-based branch')
      await runAndLogCommand(sandbox, 'git', ['checkout', '-b', branchName], logger, PROJECT_DIR)
    }

    return {
      success: true,
      sandbox,
      domain,
      branchName,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Sandbox creation error:', error)
    await logger.error('Error occurred during sandbox creation')

    return {
      success: false,
      error: errorMessage || 'Failed to create sandbox',
    }
  }
}
