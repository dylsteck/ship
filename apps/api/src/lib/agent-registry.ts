/**
 * Agent + ACP backend registry facade.
 *
 * Chat runs in the E2B VM via Agent Client Protocol bridges (`ship-acp-*` model ids).
 *
 * @packageDocumentation
 */

import { ACP_MODEL_IDS, acpBackendFromModelId, type AcpBackendKind } from './acp-types'

export type { AcpBackendKind } from './acp-types'
export type { AgentConfig, AgentMode, AgentModel } from './acp-model-catalog'
export { isKnownAcpModel, listAgents, listAvailableModels, listOpenCodeModels } from './acp-model-catalog'

export const DEFAULT_ACP_MODEL_ID = ACP_MODEL_IDS.opencode

/** Resolves a Ship model id to the ACP backend that should be spawned. */
export function resolveAcpBackend(modelId: string): AcpBackendKind {
  return acpBackendFromModelId(modelId)
}

/** Returns the default harness id used by settings and the composer. */
export function getDefaultAgentId(): string {
  return 'opencode'
}
