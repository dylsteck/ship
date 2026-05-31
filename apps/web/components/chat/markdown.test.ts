import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('streamdown', () => ({
  Streamdown({
    children,
    components,
    isAnimating,
    mode,
  }: {
    children: ReactNode
    components?: { table?: (props: { children: ReactNode }) => ReactNode }
    isAnimating: boolean
    mode: string
  }) {
    if (children === '[table]' && components?.table) {
      return React.createElement(
        'div',
        { 'data-animating': String(isAnimating), 'data-mode': mode },
        components.table({
          children: React.createElement(
            'tbody',
            null,
            React.createElement('tr', null, React.createElement('td', null, 'Cell')),
          ),
        }),
      )
    }

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

  it('adds the scoped Markdown class', () => {
    const html = renderToStaticMarkup(React.createElement(Markdown, { content: 'Hello', className: 'custom-markdown' }))

    expect(html).toContain('ship-markdown')
    expect(html).toContain('custom-markdown')
  })

  it('lets caller typography classes override defaults', () => {
    const html = renderToStaticMarkup(
      React.createElement(Markdown, { content: 'Hello', className: 'text-[12.5px] leading-5 text-zinc-300' }),
    )

    expect(html).toContain('text-[12.5px]')
    expect(html).toContain('leading-5')
    expect(html).toContain('text-zinc-300')
    expect(html).not.toContain('text-[14px]')
    expect(html).not.toContain('leading-[1.62]')
    expect(html).not.toContain('text-foreground')
  })

  it('wraps tables in an overflow container', () => {
    const html = renderToStaticMarkup(React.createElement(Markdown, { content: '[table]' }))

    expect(html).toContain('ship-markdown-table-scroll')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>Cell</td>')
  })
})
