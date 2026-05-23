/**
 * Cloudflare Workflow scaffold for **durable sandbox / bridge bootstrap** (retries TBD).
 *
 * @remarks
 * `/chat` streaming stays synchronous today — bind this workflow when adding checkpointed bootstrap steps.
 *
 * @packageDocumentation
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import type { Env } from '../env.d'

export type ShipAcpBootstrapPayload = {
  /** Reserved for Phase-F checkpoint orchestration */
  sessionId?: string
}

export class ShipAcpBootstrapWorkflow extends WorkflowEntrypoint<Env, ShipAcpBootstrapPayload> {
  async run(event: WorkflowEvent<ShipAcpBootstrapPayload>, step: WorkflowStep): Promise<{ ok: true }> {
    await step.do('bootstrap-placeholder', async () => ({
      ok: true as const,
      sessionId: event.payload.sessionId ?? null,
    }))
    return { ok: true }
  }
}
