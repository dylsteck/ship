import { describe, expect, it } from 'vitest'

import { normalizeChatMarkdown, unwrapRenderableMarkdownFences } from './markdown-normalize'

describe('unwrapRenderableMarkdownFences', () => {
  it('unwraps fenced Markdown documents so they render as prose', () => {
    const markdown = [
      '```markdown',
      '### Data pipeline',
      '',
      '| Channel | Use |',
      '| --- | --- |',
      '| SSE | UI |',
      '```',
    ].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(
      ['### Data pipeline', '', '| Channel | Use |', '| --- | --- |', '| SSE | UI |'].join('\n'),
    )
  })

  it('leaves non-markdown fences alone', () => {
    const markdown = ['```md', 'plain text without markdown shape', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(markdown)
  })
})

describe('normalizeChatMarkdown', () => {
  it('still normalizes mermaid blocks after unwrapping markdown prose', () => {
    const markdown = ['```markdown', '```mermaid', 'A -> B', '```', '```'].join('\n')

    expect(normalizeChatMarkdown(markdown)).toContain('flowchart TD')
  })
})
