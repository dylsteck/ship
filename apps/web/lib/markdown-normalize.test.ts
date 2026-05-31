import { describe, expect, it } from 'vitest'

import { normalizeChatMarkdown, trimCodeFencePadding, unwrapRenderableMarkdownFences } from './markdown-normalize'

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

  it('unwraps short prose accidentally fenced as unlabeled code', () => {
    const markdown = ['```', 'If you want to go deeper on a specific area, say which one.', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(
      'If you want to go deeper on a specific area, say which one.',
    )
  })

  it('leaves unlabeled shell command fences alone', () => {
    const markdown = ['```', 'pnpm install', 'pnpm dev', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(markdown)
  })

  it('leaves short unlabeled JavaScript snippets alone', () => {
    const markdown = ['```', 'await fetch("/api/session")', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(markdown)
  })

  it('leaves short unlabeled error output alone', () => {
    const markdown = ['```', 'Error: Cannot find module "x".', '```'].join('\n')

    expect(unwrapRenderableMarkdownFences(markdown)).toBe(markdown)
  })
})

describe('trimCodeFencePadding', () => {
  it('removes blank padding inside code fences', () => {
    const markdown = ['```bash', '', '', 'pnpm install', 'pnpm dev', '', '```'].join('\n')

    expect(trimCodeFencePadding(markdown)).toBe(['```bash', 'pnpm install', 'pnpm dev', '```'].join('\n'))
  })

  it('keeps renderable markdown fences available for unwrapping', () => {
    const markdown = ['```', '', '## Title', '', '- item', '', '```'].join('\n')

    expect(trimCodeFencePadding(markdown)).toBe(markdown)
  })
})

describe('normalizeChatMarkdown', () => {
  it('still normalizes mermaid blocks', () => {
    const markdown = ['```mermaid', 'A -> B', '```'].join('\n')

    expect(normalizeChatMarkdown(markdown)).toContain('flowchart TD')
  })

  it('unwraps prose fences and trims remaining code fences', () => {
    const markdown = [
      '```',
      'If you want to go deeper on a specific area, say which one.',
      '```',
      '',
      '```bash',
      '',
      'pnpm build',
      '',
      '```',
    ].join('\n')

    expect(normalizeChatMarkdown(markdown)).toBe(
      ['If you want to go deeper on a specific area, say which one.', '', '```bash', 'pnpm build', '```'].join('\n'),
    )
  })
})
