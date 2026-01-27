import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

export async function executeClaudeInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  isResumed?: boolean,
  sessionId?: string,
  taskId?: string,
  agentMessageId?: string,
): Promise<AgentExecutionResult> {
  try {
    await logger.info('Starting Claude agent execution...')

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      const errorMsg = 'AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY is required for Claude agent'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'claude',
        changesDetected: false,
      }
    }

    // Check if Claude CLI is installed
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['claude'])

    if (!existingCLICheck.success || !existingCLICheck.output?.includes('claude')) {
      await logger.info('Installing Claude CLI...')
      const installResult = await runInProject(sandbox, 'npm', ['install', '-g', '@anthropic-ai/claude-code'])

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Claude CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'claude',
          changesDetected: false,
        }
      }

      await logger.success('Claude CLI installed successfully')
    }

    // Build environment and command
    const envVars: Record<string, string> = {}
    if (process.env.AI_GATEWAY_API_KEY) envVars.ANTHROPIC_API_KEY = process.env.AI_GATEWAY_API_KEY
    else if (process.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

    const envPrefix = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')

    const modelFlag = selectedModel ? ` --model "${selectedModel}"` : ''
    const sessionFlags = isResumed && sessionId ? ` --resume "${sessionId}"` : ''

    const fullCommand = `${envPrefix} claude${modelFlag}${sessionFlags} --print "${instruction}"`

    await logger.info('Executing Claude CLI...')
    const executeResult = await runCommandInSandbox(sandbox, 'sh', ['-c', fullCommand])

    const stdout = executeResult.output || ''
    const stderr = executeResult.error || ''

    if (stdout && stdout.trim()) {
      await logger.info(redactSensitiveInfo(stdout.trim()))
    }
    if (stderr && stderr.trim()) {
      await logger.error(redactSensitiveInfo(stderr.trim()))
    }

    // Check for changes
    const gitStatusCheck = await runInProject(sandbox, 'git', ['status', '--porcelain'])
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (executeResult.success || executeResult.exitCode === 0) {
      await logger.success('Claude executed successfully')
      return {
        success: true,
        output: 'Claude executed successfully',
        agentResponse: stdout,
        cliName: 'claude',
        changesDetected: !!hasChanges,
      }
    } else {
      return {
        success: false,
        error: `Claude failed: ${stderr || stdout || 'Unknown error'}`,
        agentResponse: stdout,
        cliName: 'claude',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Claude in sandbox'
    await logger.error(errorMessage)
    return {
      success: false,
      error: errorMessage,
      cliName: 'claude',
      changesDetected: false,
    }
  }
}
