/**
 * ACP backend kinds — aligned with SessionDO `session_meta.acp_backend_kind`
 * and the in-VM `ship-acp-bridge` spawn targets.
 */

export type AcpBackendKind = 'codex' | 'claude' | 'cursor' | 'opencode'

export const ACP_RELAY_PORT_DEFAULT = '9847'

/** Stable model ids (also stored as session `model` preference). */
export const ACP_MODEL_IDS = {
  codex: 'ship-acp-codex',
  claude: 'ship-acp-claude',
  cursor: 'ship-acp-cursor',
  opencode: 'ship-acp-opencode',
} as const

export function acpBackendFromModelId(modelId: string | undefined): AcpBackendKind {
  const m = modelId ?? ''
  if (m === ACP_MODEL_IDS.codex || m.endsWith('-codex')) return 'codex'
  if (m === ACP_MODEL_IDS.claude || m.endsWith('-claude')) return 'claude'
  if (m === ACP_MODEL_IDS.cursor || m.endsWith('-cursor')) return 'cursor'
  return 'opencode'
}
