import { describe, expect, it } from 'vitest'

import type { ChatSession } from '@/lib/api/server'
import { mergeRemoteSessions } from './merge-remote-sessions'

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
})
