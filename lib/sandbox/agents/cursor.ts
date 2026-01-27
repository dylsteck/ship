import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

export async function executeCursorInSandbox(
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
    await logger.info('Starting Cursor agent execution...')

    if (!process.env.CURSOR_API_KEY) {
      const errorMsg = 'CURSOR_API_KEY is required for Cursor agent'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'cursor',
        changesDetected: false,
      }
    }

    // Check if Cursor CLI is installed
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['cursor'])

    if (!existingCLICheck.success || !existingCLICheck.output?.includes('cursor')) {
      await logger.info('Installing Cursor CLI...')
      const installResult = await runInProject(sandbox, 'npm', ['install', '-g', '@anthropic-ai/cursor-code'])

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Cursor CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'cursor',
          changesDetected: false,
        }
      }

      await logger.success('Cursor CLI installed successfully')
    }

    const envPrefix = `CURSOR_API_KEY="${process.env.CURSOR_API_KEY}"`
    const modelFlag = selectedModel ? ` --model "${selectedModel}"` : ''
    const sessionFlags = isResumed && sessionId ? ` --resume "${sessionId}"` : ''

    const fullCommand = `${envPrefix} cursor${modelFlag}${sessionFlags} --print "${instruction}"`

    await logger.info('Executing Cursor CLI...')
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
      await logger.success('Cursor executed successfully')
      return {
        success: true,
        output: 'Cursor executed successfully',
        agentResponse: stdout,
        cliName: 'cursor',
        changesDetected: !!hasChanges,
      }
    } else {
      return {
        success: false,
        error: `Cursor failed: ${stderr || stdout || 'Unknown error'}`,
        agentResponse: stdout,
        cliName: 'cursor',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Cursor in sandbox'
    await logger.error(errorMessage)
    return {
      success: false,
      error: errorMessage,
      cliName: 'cursor',
      changesDetected: false,
    }
  }
}
