import { describe, expect, it } from 'vitest'

import { normalizeMermaidCodeBlocks } from './markdown-mermaid'

describe('normalizeMermaidCodeBlocks', () => {
  it('leaves valid Mermaid diagrams unchanged', () => {
    const markdown = ['```mermaid', 'flowchart TD', '  A --> B', '```'].join('\n')

    expect(normalizeMermaidCodeBlocks(markdown)).toBe(markdown)
  })

  it('converts indented arrow outlines into flowcharts', () => {
    const markdown = [
      '```mermaid',
      '/fids/$fid loader',
      '  -> Hypersnap user profile',
      '  -> Farcaster keys',
      '',
      'Client (ProfileDetails)',
      '  -> GET /api/signers/enriched?fid=X',
      '    -> Snapchain: on-chain signers + all messages',
      'Click app -> ?signer_fid=Y',
      '```',
    ].join('\n')

    const normalized = normalizeMermaidCodeBlocks(markdown)

    expect(normalized).toContain('flowchart TD')
    expect(normalized).toContain('n0["/fids/$fid loader"]')
    expect(normalized).toContain('n0 --> n1')
    expect(normalized).toContain('n3["Client (ProfileDetails)"]')
    expect(normalized).toContain('n4 --> n5')
    expect(normalized).toContain('n6["Click app"]')
    expect(normalized).toContain('n6 --> n7')
  })

  it('leaves non-diagram prose alone when it cannot infer edges', () => {
    const markdown = ['```mermaid', 'just a label', '```'].join('\n')

    expect(normalizeMermaidCodeBlocks(markdown)).toBe(markdown)
  })
})
