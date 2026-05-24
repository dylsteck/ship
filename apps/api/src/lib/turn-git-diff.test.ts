import { describe, expect, it } from 'vitest'

import {
  diffNumstatMaps,
  mergeNumstatMaps,
  numstatMapToDiffSummary,
  parseGitNumstat,
} from './turn-git-diff'

describe('parseGitNumstat', () => {
  it('parses standard numstat lines', () => {
    const map = parseGitNumstat(['3\t1\tsrc/a.ts', '0\t5\tsrc/b.ts'].join('\n'))
    expect(map.get('src/a.ts')).toEqual({ additions: 3, deletions: 1 })
    expect(map.get('src/b.ts')).toEqual({ additions: 0, deletions: 5 })
  })

  it('merges duplicate filenames', () => {
    const map = mergeNumstatMaps(
      parseGitNumstat('1\t0\tsrc/a.ts'),
      parseGitNumstat('2\t1\tsrc/a.ts'),
    )
    expect(map.get('src/a.ts')).toEqual({ additions: 3, deletions: 1 })
  })
})

describe('diffNumstatMaps', () => {
  it('returns per-turn file deltas', () => {
    const baseline = parseGitNumstat('1\t0\tsrc/a.ts')
    const current = parseGitNumstat('4\t1\tsrc/a.ts\n0\t2\tsrc/new.ts')
    const delta = diffNumstatMaps(baseline, current)

    expect(delta.get('src/a.ts')).toEqual({ additions: 3, deletions: 1 })
    expect(delta.get('src/new.ts')).toEqual({ additions: 0, deletions: 2 })
  })
})

describe('numstatMapToDiffSummary', () => {
  it('validates TurnDiffSummary rows', () => {
    const rows = numstatMapToDiffSummary(parseGitNumstat('2\t1\tsrc/index.ts'))
    expect(rows).toEqual([{ filename: 'src/index.ts', additions: 2, deletions: 1 }])
  })
})
