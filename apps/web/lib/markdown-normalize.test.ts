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

  it('unwraps explicit markdown fences even when the body is plain', () => {
    const markdown = ['```md', 'plain text without markdown shape', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe('plain text without markdown shape')
  })

  it('unwraps unlabeled fences that contain a Markdown document', () => {
    const markdown = ['```', '---', '## Auth model', '', '- **Session JWT** authenticates users', '---', '```'].join(
      '\n',
    )

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(
      ['---', '## Auth model', '', '- **Session JWT** authenticates users', '---'].join('\n'),
    )
  })

  it('leaves unlabeled code fences alone', () => {
    const markdown = ['```', 'const value = 1', 'function run() {', '  return value', '}', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(markdown)
  })
})

describe('normalizeChatMarkdown', () => {
  it('still normalizes mermaid blocks', () => {
    const markdown = ['```mermaid', 'A -> B', '```'].join('\n')

    expect(normalizeChatMarkdown(markdown)).toContain('flowchart TD')
  })
})
