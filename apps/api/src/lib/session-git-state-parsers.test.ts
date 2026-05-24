import { describe, expect, it } from 'vitest'
import {
  buildDiffFiles,
  mergeStatusFiles,
  parseGitCommitLog,
  parseGitNameStatus,
  parseGitStatusFiles,
  summarizeChecks,
} from './session-git-state-parsers'

describe('session git state parsers', () => {
  it('parses name-status rows including renames', () => {
    const rows = parseGitNameStatus(['M\tapps/web/page.tsx', 'A\tREADME.md', 'R100\told.ts\tnew.ts'].join('\n'))

    expect(rows.get('apps/web/page.tsx')).toEqual({ status: 'modified' })
    expect(rows.get('README.md')).toEqual({ status: 'added' })
    expect(rows.get('new.ts')).toEqual({ status: 'renamed', oldFilename: 'old.ts' })
  })

  it('combines numstat and status rows into sorted file summaries', () => {
    const files = buildDiffFiles('10\t2\tb.ts\n1\t0\ta.ts', 'M\tb.ts\nA\ta.ts')

    expect(files).toEqual([
      { filename: 'a.ts', status: 'added', additions: 1, deletions: 0 },
      { filename: 'b.ts', status: 'modified', additions: 10, deletions: 2 },
    ])
  })

  it('parses structured commit log rows', () => {
    const commits = parseGitCommitLog('abcdef\u001fabcd\u001fAda\u001fada@example.com\u001f2026-05-24T10:00:00Z\u001fShip it')

    expect(commits).toEqual([
      {
        hash: 'abcdef',
        shortHash: 'abcd',
        authorName: 'Ada',
        authorEmail: 'ada@example.com',
        authoredAt: '2026-05-24T10:00:00Z',
        subject: 'Ship it',
      },
    ])
  })

  it('adds untracked files from porcelain status rows', () => {
    const rows = mergeStatusFiles([], parseGitStatusFiles('?? new-file.ts\n M existing.ts'))

    expect(rows).toEqual([
      { filename: 'existing.ts', status: 'modified', additions: 0, deletions: 0 },
      { filename: 'new-file.ts', status: 'added', additions: 0, deletions: 0 },
    ])
  })

  it('summarizes check states by worst active state', () => {
    expect(summarizeChecks(['success', 'completed']).state).toBe('pending')
    expect(summarizeChecks(['success', 'failure']).state).toBe('failure')
    expect(summarizeChecks(['success', 'error']).state).toBe('error')
    expect(summarizeChecks(['success', 'neutral']).state).toBe('success')
    expect(summarizeChecks([]).state).toBe('unknown')
  })
})
