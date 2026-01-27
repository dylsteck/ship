import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

export async function executeCopilotInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  isResumed?: boolean,
  sessionId?: string,
  taskId?: string,
): Promise<AgentExecutionResult> {
  try {
    await logger.info('Starting GitHub Copilot agent execution...')

    // Check if ghcp CLI is installed
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['ghcp'])

    if (!existingCLICheck.success || !existingCLICheck.output?.includes('ghcp')) {
      await logger.info('Installing GitHub Copilot CLI...')
      const installResult = await runInProject(sandbox, 'npm', ['install', '-g', '@githubnext/ghcp'])

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Copilot CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'copilot',
          changesDetected: false,
        }
      }

      await logger.success('Copilot CLI installed successfully')
    }

    const sessionFlags = isResumed ? ' --continue' : ''
    const fullCommand = `ghcp${sessionFlags} "${instruction}"`

    await logger.info('Executing Copilot CLI...')
    const executeResult = await runCommandInSandbox(sandbox, 'sh', ['-c', fullCommand])

    const stdout = executeResult.output || ''
    const stderr = executeResult.error || ''

    if (stdout && stdout.trim()) {
      await logger.info(redactSensitiveInfo(stdout.trim()))
    }

    // Check for changes
    const gitStatusCheck = await runInProject(sandbox, 'git', ['status', '--porcelain'])
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (executeResult.success || executeResult.exitCode === 0) {
      await logger.success('Copilot executed successfully')
      return {
        success: true,
        output: 'Copilot executed successfully',
        agentResponse: stdout,
        cliName: 'copilot',
        changesDetected: !!hasChanges,
      }
    } else {
      return {
        success: false,
        error: `Copilot failed: ${stderr || stdout || 'Unknown error'}`,
        agentResponse: stdout,
        cliName: 'copilot',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Copilot in sandbox'
    await logger.error(errorMessage)
    return {
      success: false,
      error: errorMessage,
      cliName: 'copilot',
      changesDetected: false,
    }
  }
}
