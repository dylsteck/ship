import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

async function runAndLogCommand(sandbox: Sandbox, command: string, args: string[], logger: TaskLogger) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
  const redactedCommand = redactSensitiveInfo(fullCommand)

  await logger.command(redactedCommand)

  const result = await runInProject(sandbox, command, args)

  if (result && result.output && result.output.trim()) {
    await logger.info(redactSensitiveInfo(result.output.trim()))
  }

  if (result && !result.success && result.error) {
    await logger.error(redactSensitiveInfo(result.error))
  }

  if (!result) {
    const errorResult = {
      success: false,
      error: 'Command execution failed - no result returned',
      exitCode: -1,
      output: '',
      command: redactedCommand,
    }
    await logger.error('Command execution failed - no result returned')
    return errorResult
  }

  return result
}

export async function executeOpenCodeInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  isResumed?: boolean,
  sessionId?: string,
): Promise<AgentExecutionResult> {
  try {
    await logger.info('Starting OpenCode agent execution...')

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      const errorMsg = 'OpenAI API key or Anthropic API key is required for OpenCode agent'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'opencode',
        changesDetected: false,
      }
    }

    // Check if OpenCode CLI is already installed
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['opencode'])

    if (!existingCLICheck.success || !existingCLICheck.output?.includes('opencode')) {
      await logger.info('Installing OpenCode CLI...')
      const installResult = await runAndLogCommand(sandbox, 'npm', ['install', '-g', 'opencode-ai'], logger)

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install OpenCode CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'opencode',
          changesDetected: false,
        }
      }

      await logger.success('OpenCode CLI installed successfully')
    } else {
      await logger.info('OpenCode CLI already installed, skipping installation')
    }

    // Verify OpenCode CLI
    await runAndLogCommand(sandbox, 'opencode', ['--version'], logger)

    // Set up environment variables for the OpenCode execution
    const envVars: Record<string, string> = {}
    if (process.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (process.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

    const envPrefix = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')

    await logger.info('Executing OpenCode run command in non-interactive mode...')

    const modelFlag = selectedModel ? ` --model "${selectedModel}"` : ''
    let sessionFlags = ''
    if (isResumed) {
      sessionFlags = sessionId ? ` --session "${sessionId}"` : ' --continue'
      await logger.info(sessionId ? 'Resuming specific OpenCode session' : 'Continuing last OpenCode session')
    }

    const fullCommand = `${envPrefix} opencode run${modelFlag}${sessionFlags} "${instruction}"`

    const executeResult = await runCommandInSandbox(sandbox, 'sh', ['-c', fullCommand])

    const stdout = executeResult.output || ''
    const stderr = executeResult.error || ''

    if (stdout && stdout.trim()) {
      await logger.info(redactSensitiveInfo(stdout.trim()))
    }
    if (stderr && stderr.trim()) {
      await logger.error(redactSensitiveInfo(stderr.trim()))
    }

    // Extract session ID from output if present
    let extractedSessionId: string | undefined
    const sessionMatch = stdout?.match(/(?:session[_\s-]?id|Session)[:\s]+([a-f0-9-]+)/i)
    if (sessionMatch) extractedSessionId = sessionMatch[1]

    // Check if any files were modified
    const gitStatusCheck = await runAndLogCommand(sandbox, 'git', ['status', '--porcelain'], logger)
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (executeResult.success || executeResult.exitCode === 0) {
      const successMsg = `OpenCode executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`
      await logger.success(successMsg)

      return {
        success: true,
        output: successMsg,
        agentResponse: stdout || 'OpenCode completed the task',
        cliName: 'opencode',
        changesDetected: !!hasChanges,
        sessionId: extractedSessionId,
      }
    } else {
      const errorMsg = `OpenCode failed (exit code ${executeResult.exitCode}): ${stderr || stdout || 'No error message'}`
      await logger.error(errorMsg)

      return {
        success: false,
        error: errorMsg,
        agentResponse: stdout,
        cliName: 'opencode',
        changesDetected: !!hasChanges,
        sessionId: extractedSessionId,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute OpenCode in sandbox'
    await logger.error(errorMessage)

    return {
      success: false,
      error: errorMessage,
      cliName: 'opencode',
      changesDetected: false,
    }
  }
}
