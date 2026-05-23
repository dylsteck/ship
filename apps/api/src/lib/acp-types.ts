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

/** Parsed Ship ACP model id, including an optional backend-specific model id. */
export interface AcpModelSelection {
  backend: AcpBackendKind
  /** Backend-native model id, for example `opencode/gpt-5.5`. */
  upstreamModelId?: string
}

/** Builds a Ship model id for a concrete ACP backend model. */
export function acpModelId(backend: AcpBackendKind, upstreamModelId?: string): string {
  const base = ACP_MODEL_IDS[backend]
  return upstreamModelId ? `${base}:${upstreamModelId}` : base
}

/** Parses legacy harness ids and concrete `ship-acp-*:provider/model` ids. */
export function parseAcpModelId(modelId: string | undefined): AcpModelSelection {
  const m = modelId ?? ''
  const entries = Object.entries(ACP_MODEL_IDS) as Array<[AcpBackendKind, string]>
  for (const [backend, baseId] of entries) {
    if (m === baseId || m.endsWith(`-${backend}`)) return { backend }
    if (m.startsWith(`${baseId}:`)) {
      const upstreamModelId = m.slice(baseId.length + 1).trim()
      return upstreamModelId ? { backend, upstreamModelId } : { backend }
    }
  }
  return { backend: 'opencode' }
}

export function acpBackendFromModelId(modelId: string | undefined): AcpBackendKind {
  return parseAcpModelId(modelId).backend
}
