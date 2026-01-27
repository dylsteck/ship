import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

export async function executeGeminiInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
): Promise<AgentExecutionResult> {
  try {
    await logger.info('Starting Gemini agent execution...')

    if (!process.env.GEMINI_API_KEY) {
      const errorMsg = 'GEMINI_API_KEY is required for Gemini agent'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'gemini',
        changesDetected: false,
      }
    }

    // Check if Gemini CLI is installed
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['gemini'])

    if (!existingCLICheck.success || !existingCLICheck.output?.includes('gemini')) {
      await logger.info('Installing Gemini CLI...')
      const installResult = await runInProject(sandbox, 'npm', ['install', '-g', '@anthropic-ai/gemini-code'])

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Gemini CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'gemini',
          changesDetected: false,
        }
      }

      await logger.success('Gemini CLI installed successfully')
    }

    const envPrefix = `GEMINI_API_KEY="${process.env.GEMINI_API_KEY}"`
    const modelFlag = selectedModel ? ` --model "${selectedModel}"` : ''

    const fullCommand = `${envPrefix} gemini${modelFlag} --print "${instruction}"`

    await logger.info('Executing Gemini CLI...')
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
      await logger.success('Gemini executed successfully')
      return {
        success: true,
        output: 'Gemini executed successfully',
        agentResponse: stdout,
        cliName: 'gemini',
        changesDetected: !!hasChanges,
      }
    } else {
      return {
        success: false,
        error: `Gemini failed: ${stderr || stdout || 'Unknown error'}`,
        agentResponse: stdout,
        cliName: 'gemini',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Gemini in sandbox'
    await logger.error(errorMessage)
    return {
      success: false,
      error: errorMessage,
      cliName: 'gemini',
      changesDetected: false,
    }
  }
}
