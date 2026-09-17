import { describe, expect, it } from 'vitest'

import type { ChatSession } from '@/lib/api/server'
import { mergeRemoteSessions, uniqueSessionsById, upsertLocalSession } from './merge-remote-sessions'

function session(overrides: Partial<ChatSession> & Pick<ChatSession, 'id'>): ChatSession {
  return {
    userId: 'user-1',
    repoOwner: 'acme',
    repoName: 'ship',
    status: 'active',
    lastActivity: 100,
    createdAt: 100,
    archivedAt: null,
    ...overrides,
  }
}

describe('mergeRemoteSessions', () => {
  it('returns the previous array when remote rows are equivalent', () => {
    const local = [session({ id: 's1', title: 'Hello' })]
    const remote = [session({ id: 's1', title: 'Hello' })]
    expect(mergeRemoteSessions(local, remote, new Set())).toBe(local)
  })

  it('keeps optimistic creates that have not appeared remotely yet', () => {
    const optimistic = session({ id: 'pending', title: 'New chat' })
    const remote = [session({ id: 's1', title: 'Hello' })]
    const merged = mergeRemoteSessions([optimistic], remote, new Set(['pending']))
    expect(merged.map((row) => row.id)).toEqual(['pending', 's1'])
  })

  it('drops optimistic rows once the remote list contains them', () => {
    const optimistic = session({ id: 's1', title: 'Draft' })
    const remote = [session({ id: 's1', title: 'Saved' })]
    const merged = mergeRemoteSessions([optimistic], remote, new Set(['s1']))
    expect(merged).toEqual([session({ id: 's1', title: 'Saved' })])
  })

  it('preserves local-only fields when the remote row omits them', () => {
    const local = [session({ id: 's1', title: 'Kept', userId: 'user-1', sandboxId: 'sbx_1' })]
    const remote = [session({ id: 's1', title: '', userId: '', sandboxId: undefined })]
    expect(mergeRemoteSessions(local, remote, new Set())).toEqual([
      session({ id: 's1', title: 'Kept', userId: 'user-1', sandboxId: 'sbx_1' }),
    ])
  })

  it('collapses duplicate ids from optimistic prepend plus a shell upsert', () => {
    const row = session({ id: 's1', title: 'Hello' })
    const merged = mergeRemoteSessions([row, row], [row], new Set(['s1']))
    expect(merged.map((item) => item.id)).toEqual(['s1'])
  })
})

describe('uniqueSessionsById', () => {
  it('returns the same array when ids are already unique', () => {
    const rows = [session({ id: 's1' }), session({ id: 's2' })]
    expect(uniqueSessionsById(rows)).toBe(rows)
  })

  it('keeps the first occurrence of a duplicated id', () => {
    const first = session({ id: 's1', title: 'Optimistic' })
    const second = session({ id: 's1', title: 'Shell' })
    expect(uniqueSessionsById([first, second])).toEqual([first])
  })
})

describe('upsertLocalSession', () => {
  it('prepends a session that is not already local', () => {
    const existing = session({ id: 's1', title: 'Hello' })
    const created = session({ id: 's2', title: 'New' })
    expect(upsertLocalSession([existing], created).map((row) => row.id)).toEqual(['s2', 's1'])
  })

  it('replaces an existing row instead of duplicating it', () => {
    const existing = session({ id: 's1', title: 'Hello' })
    const created = session({ id: 's1', title: 'Updated' })
    expect(upsertLocalSession([existing], created)).toEqual([created])
  })
})
