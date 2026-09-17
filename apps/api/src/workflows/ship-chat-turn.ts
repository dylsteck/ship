/**
 * Browser-independent durable execution for one accepted Ship chat turn.
 *
 * @packageDocumentation
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import type { TurnId } from '@ship/contracts'

import type { Env } from '../env.d'
import { publishShellSession } from '../lib/shell-summary'
import {
  executeTurnAgent,
  generateTurnTitle,
  prepareTurnWorkspace,
  type ExecutedTurn,
} from './ship-chat-turn-execution'

/** Minimal non-sensitive payload used to start a chat turn Workflow. */
export interface ShipChatTurnPayload {
  sessionId: string
  turnId: string
  userId: string
}

interface TurnClaim {
  attemptId: string
  claimed: boolean
  terminal: boolean
  promptSent: boolean
}

/** Workflow that owns workspace preparation, prompt execution, and finalization. */
export class ShipChatTurnWorkflow extends WorkflowEntrypoint<Env, ShipChatTurnPayload> {
  async run(event: WorkflowEvent<ShipChatTurnPayload>, step: WorkflowStep): Promise<ExecutedTurn> {
    const { sessionId, turnId, userId } = event.payload
    const stub = this.env.SESSION_DO.getByName(sessionId)
    console.log(JSON.stringify({ event: 'turn_workflow_started', sessionId, turnId }))

    const claim = await step.do<TurnClaim>('claim-turn', async () => {
      const attemptId = crypto.randomUUID()
      const result = await stub.claimAcceptedTurn(turnId, event.instanceId, attemptId)
      return {
        attemptId,
        claimed: result.claimed,
        terminal: result.terminal,
        promptSent: result.promptSent,
      }
    })
    if (claim.terminal || !claim.claimed) {
      return { outcome: claim.terminal ? 'completed' : 'interrupted' }
    }

    let executed: ExecutedTurn
    try {
      const workspace = await prepareTurnWorkspace(
        this.env,
        step,
        stub,
        sessionId,
        turnId,
        userId,
        claim.attemptId,
      )
      executed = await executeTurnAgent(this.env, step, stub, sessionId, turnId, claim.attemptId, workspace)
    } catch (error) {
      executed = { outcome: 'failed', error: error instanceof Error ? error.message : 'Turn preparation failed' }
    }

    await step.do('finalize-turn', async () => {
      await stub.finalizeAcceptedTurn(sessionId, turnId, executed.outcome, executed.error, executed.diffSummary)
      await publishShellSession(this.env, sessionId, {
        state: executed.outcome === 'failed' ? 'failed' : 'idle',
        latestTurnId: turnId as TurnId,
      })
      return { finalized: true }
    })

    if (executed.outcome === 'completed') {
      await generateTurnTitle(this.env, step, stub, sessionId)
      await publishShellSession(this.env, sessionId)
    }
    console.log(JSON.stringify({
      event: executed.outcome === 'completed' ? 'turn_workflow_completed' : 'turn_workflow_failed',
      sessionId,
      turnId,
      outcome: executed.outcome,
    }))
    return executed
  }
}
