import { describe, expect, it } from 'vitest'

import { firstSqlRow } from './sql-first'

describe('firstSqlRow', () => {
  it('returns null when the cursor is empty', () => {
    expect(firstSqlRow({ toArray: () => [] })).toBeNull()
  })

  it('returns the first matched row', () => {
    expect(firstSqlRow({ toArray: () => [{ value: 'user-1' }, { value: 'user-2' }] })).toEqual({ value: 'user-1' })
  })
})
