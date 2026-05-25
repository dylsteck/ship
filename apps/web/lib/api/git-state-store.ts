'use client'

import { create } from 'zustand'
import type { GitState } from '@ship/sdk'

interface GitStateStore {
  bySession: Record<string, GitState>
  setGitState: (sessionId: string, state: GitState) => void
}

export const useGitStateStore = create<GitStateStore>((set) => ({
  bySession: {},
  setGitState: (sessionId, state) =>
    set((current) => ({
      bySession: {
        ...current.bySession,
        [sessionId]: state,
      },
    })),
}))
