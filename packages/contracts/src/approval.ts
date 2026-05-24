import { z } from 'zod'

/** Provider approval policy for sandboxed agent actions. */
export const ApprovalPolicySchema = z.enum(['untrusted', 'on-failure', 'on-request', 'never'])
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>

/** User response to an approval prompt. */
export const ApprovalResponseSchema = z.enum(['accept', 'acceptForSession', 'decline', 'cancel'])
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>
