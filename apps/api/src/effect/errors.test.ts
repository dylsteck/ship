import { describe, expect, it } from 'vitest'

import {
  DatabaseError,
  GitHubApiError,
  SandboxConnectError,
  SandboxCreateError,
  SandboxNotFoundError,
  toHttpErrorResponse,
} from './errors'

describe('tagged errors', () => {
  it('carries a stable _tag, http status and retryable flag', () => {
    const db = new DatabaseError({ operation: 'accounts.select', cause: new Error('boom') })
    expect(db._tag).toBe('DatabaseError')
    expect(db.httpStatus).toBe(500)
    expect(db.retryable).toBe(true)
    expect(db.message).toContain('accounts.select')
  })

  it('derives GitHub api status and retryability from the upstream status', () => {
    expect(new GitHubApiError({ operation: 'oauth.refresh' }).retryable).toBe(true)
    expect(new GitHubApiError({ operation: 'oauth.refresh', status: 502 }).retryable).toBe(true)
    expect(new GitHubApiError({ operation: 'oauth.refresh', status: 401 }).retryable).toBe(false)
    expect(new GitHubApiError({ operation: 'oauth.refresh', status: 418 }).httpStatus).toBe(418)
  })

  it('marks not-found sandboxes as 404 and non-retryable', () => {
    const err = new SandboxNotFoundError({ sandboxId: 'sbx-1' })
    expect(toHttpErrorResponse(err)).toEqual({
      status: 404,
      body: { error: 'SandboxNotFoundError', message: 'Sandbox not found: sbx-1', retryable: false },
    })
  })

  it('maps sandbox provider failures to 502', () => {
    expect(toHttpErrorResponse(new SandboxCreateError({ cause: 'x' })).status).toBe(502)
    expect(
      toHttpErrorResponse(new SandboxConnectError({ sandboxId: 'sbx-2', cause: 'x' })).status,
    ).toBe(502)
  })
})
