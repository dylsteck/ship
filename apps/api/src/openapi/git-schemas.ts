import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

const gitPrSchema = z.object({
  number: z.number(),
  url: z.string(),
  draft: z.boolean(),
  title: z.string().optional(),
  body: z.string().optional(),
  merged: z.boolean().optional(),
  state: z.string().optional(),
  headSha: z.string().optional(),
  headBranch: z.string().optional(),
  baseBranch: z.string().optional(),
})

export const gitMergeBodySchema = z.object({
  method: z.enum(['merge', 'squash', 'rebase']),
})

export const gitMergeResponseSchema = z.object({
  success: z.boolean(),
  merged: z.boolean().optional(),
  message: z.string().optional(),
  sha: z.string().optional(),
})

const gitCheckJobSchema = z.object({
  name: z.string(),
  state: z.enum(['pending', 'success', 'failure', 'error', 'neutral', 'unknown']),
  status: z.string().optional(),
  conclusion: z.string().optional(),
  url: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
})

const gitChecksSchema = z.object({
  state: z.enum(['pending', 'success', 'failure', 'error', 'neutral', 'unknown']),
  total: z.number().int(),
  pending: z.number().int(),
  success: z.number().int(),
  failure: z.number().int(),
  jobs: z.array(gitCheckJobSchema).optional(),
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
