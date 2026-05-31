import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('streamdown', () => ({
  Streamdown({ children, isAnimating, mode }: { children: ReactNode; isAnimating: boolean; mode: string }) {
    return React.createElement('div', { 'data-animating': String(isAnimating), 'data-mode': mode }, children)
  },
}))

vi.mock('@streamdown/code', () => ({ code: {} }))
vi.mock('@streamdown/mermaid', () => ({ mermaid: {} }))
vi.mock('./mermaid-block', () => ({ MermaidBlockRenderer: () => null }))

import { Markdown } from './markdown'

describe('Markdown', () => {
  it('uses Streamdown streaming mode while animating', () => {
    const html = renderToStaticMarkup(React.createElement(Markdown, { content: 'Hello', isAnimating: true }))

    expect(html).toContain('data-mode="streaming"')
    expect(html).toContain('data-animating="true"')
  })

  it('uses Streamdown static mode after streaming finishes', () => {
    const html = renderToStaticMarkup(React.createElement(Markdown, { content: 'Hello', isAnimating: false }))

    expect(html).toContain('data-mode="static"')
    expect(html).toContain('data-animating="false"')
  })
})
