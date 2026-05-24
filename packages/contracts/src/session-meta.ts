import { z } from 'zod'

import { ApprovalPolicySchema } from './approval'

export const AcpBackendKindSchema = z.enum(['codex', 'claude', 'cursor', 'opencode'])
export type AcpBackendKind = z.infer<typeof AcpBackendKindSchema>

/**
 * Typed view of Session DO `session_meta` keys used by chat and model routes.
 */
export const SessionMetaSchema = z.object({
  approvalPolicy: ApprovalPolicySchema.optional(),
  model: z.string().optional(),
  acp_backend_kind: AcpBackendKindSchema.optional(),
  acp_protocol_session_id: z.string().optional(),
  acp_protocol_session_backend: z.string().optional(),
  acp_protocol_session_cwd: z.string().optional(),
})
export type SessionMeta = z.infer<typeof SessionMetaSchema>
