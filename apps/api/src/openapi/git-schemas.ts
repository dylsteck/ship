import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

const gitPrSchema = z.object({
  number: z.number(),
  url: z.string(),
  draft: z.boolean(),
  title: z.string().optional(),
  state: z.string().optional(),
  headSha: z.string().optional(),
  baseBranch: z.string().optional(),
})

const gitChecksSchema = z.object({
  state: z.enum(['pending', 'success', 'failure', 'error', 'neutral', 'unknown']),
  total: z.number().int(),
  pending: z.number().int(),
  success: z.number().int(),
  failure: z.number().int(),
})

const gitDiffFileSchema = z.object({
  filename: z.string(),
  oldFilename: z.string().optional(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'copied', 'changed']),
  additions: z.number().int(),
  deletions: z.number().int(),
})

/** Git state response for the session right sidebar. */
export const gitStateSchema = z
  .object({
    branchName: z.string().optional(),
    branch: z.string().optional(),
    hasChanges: z.boolean().optional(),
    dirty: z.boolean().optional(),
    pr: gitPrSchema.optional(),
    prUrl: z.string().optional(),
    prStatus: z.string().optional(),
    repoUrl: z.string().optional(),
    baseBranch: z.string().optional(),
    checks: gitChecksSchema.optional(),
    diff: z
      .object({
        patch: z.string(),
        truncated: z.boolean().optional(),
        files: z.array(gitDiffFileSchema),
        additions: z.number().int(),
        deletions: z.number().int(),
      })
      .optional(),
    commits: z
      .array(
        z.object({
          hash: z.string(),
          shortHash: z.string(),
          subject: z.string(),
          authorName: z.string(),
          authorEmail: z.string(),
          authoredAt: z.string(),
        }),
      )
      .optional(),
  })
  .openapi('GitState')
