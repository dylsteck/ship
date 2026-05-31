import { describe, expect, it } from 'vitest'

import {
  getNextPacedText,
  getNextPacedTextLength,
  getPacedTextStepSize,
} from './streaming-text-pacing'

describe('streaming text pacing', () => {
  it('reveals append-only text gradually while streaming', () => {
    expect(getNextPacedText('Hello streaming world', '', true)).toBe('Hello ')
  })

  it('snaps to nearby punctuation or whitespace', () => {
    const text = 'Hello, world'

    expect(getNextPacedTextLength(text, 0)).toBe(6)
  })

  it('resets immediately for non-append-only updates', () => {
    expect(getNextPacedText('Replacement text', 'Previous', true)).toBe('Replacement text')
  })

  it('returns full content immediately after streaming ends', () => {
    expect(getNextPacedText('Final response', 'Fi', false)).toBe('Final response')
  })

  it('uses larger steps for larger backlogs', () => {
    expect(getPacedTextStepSize(8)).toBe(2)
    expect(getPacedTextStepSize(40)).toBe(4)
    expect(getPacedTextStepSize(80)).toBe(8)
    expect(getPacedTextStepSize(240)).toBe(24)
  })
})
