import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

export async function executeCodexInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  isResumed?: boolean,
  sessionId?: string,
): Promise<AgentExecutionResult> {
  try {
    await logger.info('Starting Codex agent execution...')

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
      const errorMsg = 'AI_GATEWAY_API_KEY or OPENAI_API_KEY is required for Codex agent'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'codex',
        changesDetected: false,
      }
    }

    // Check if Codex CLI is installed
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['codex'])

    if (!existingCLICheck.success || !existingCLICheck.output?.includes('codex')) {
      await logger.info('Installing Codex CLI...')
      const installResult = await runInProject(sandbox, 'npm', ['install', '-g', '@openai/codex'])

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Codex CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'codex',
          changesDetected: false,
        }
      }

      await logger.success('Codex CLI installed successfully')
    }

    // Build environment and command
    const envVars: Record<string, string> = {}
    if (process.env.AI_GATEWAY_API_KEY) envVars.OPENAI_API_KEY = process.env.AI_GATEWAY_API_KEY
    else if (process.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY

    const envPrefix = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')

    const modelFlag = selectedModel ? ` --model "${selectedModel}"` : ''
    const sessionFlags = isResumed && sessionId ? ` --session "${sessionId}"` : ''

    const fullCommand = `${envPrefix} codex${modelFlag}${sessionFlags} "${instruction}"`

    await logger.info('Executing Codex CLI...')
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
      await logger.success('Codex executed successfully')
      return {
        success: true,
        output: 'Codex executed successfully',
        agentResponse: stdout,
        cliName: 'codex',
        changesDetected: !!hasChanges,
      }
    } else {
      return {
        success: false,
        error: `Codex failed: ${stderr || stdout || 'Unknown error'}`,
        agentResponse: stdout,
        cliName: 'codex',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Codex in sandbox'
    await logger.error(errorMessage)
    return {
      success: false,
      error: errorMessage,
      cliName: 'codex',
      changesDetected: false,
    }
  }
}
