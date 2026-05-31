import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ToolInvocation, UIMessage } from '@/lib/ai-elements-adapter'

vi.mock('@ship/ui', () => ({
  Response({ children }: { children: ReactNode }) {
    return React.createElement('section', { 'data-kind': 'response' }, children)
  },
  ThinkingBlock({ children, reasoning }: { children?: ReactNode; reasoning?: string[] }) {
    return React.createElement(
      'section',
      { 'data-kind': 'thinking' },
      reasoning?.map((text) => React.createElement('span', { key: text, 'data-kind': 'reasoning' }, text)),
      children,
    )
  },
}))

vi.mock('@/components/chat/markdown', () => ({
  Markdown({ content }: { content: string }) {
    return React.createElement('span', { 'data-kind': 'markdown' }, content)
  },
}))

vi.mock('./messages/tool-list', () => ({
  MessageToolList({ tools }: { tools: ToolInvocation[] }) {
    return React.createElement('div', { 'data-kind': 'tools', 'data-count': String(tools.length) })
  },
}))

vi.mock('./assistant-run-plan-items', () => ({
  AssistantRunPlanItems() {
    return React.createElement('section', { 'data-kind': 'plan' })
  },
}))

import { AssistantOrderedParts } from './assistant-ordered-parts'

function tool(id: string): ToolInvocation {
  return { toolCallId: id, toolName: 'bash', state: 'result', args: {}, result: 'ok' }
}

function render(message: UIMessage): string {
  return renderToStaticMarkup(
    React.createElement(AssistantOrderedParts, {
      messages: [message],
      isStreaming: false,
      sessionTodos: [],
      todoRenderedRef: { current: false },
      onSubagentNavigate: () => {},
    }),
  )
}

describe('AssistantOrderedParts', () => {
  it('renders text, tool, and text in ordered sequence', () => {
    const html = render({
      id: 'assistant-1',
      role: 'assistant',
      content: 'Before.After.',
      orderedParts: [
        { id: 'text-1', kind: 'text', text: 'Before.' },
        { id: 'tool-1', kind: 'tool', tool: tool('tool-1') },
        { id: 'text-2', kind: 'text', text: 'After.' },
      ],
    })

    expect(html.indexOf('Before.')).toBeLessThan(html.indexOf('data-kind="tools"'))
    expect(html.indexOf('data-kind="tools"')).toBeLessThan(html.indexOf('After.'))
  })

  it('groups only adjacent tool parts', () => {
    const html = render({
      id: 'assistant-1',
      role: 'assistant',
      content: 'middle',
      orderedParts: [
        { id: 'tool-1', kind: 'tool', tool: tool('tool-1') },
        { id: 'tool-2', kind: 'tool', tool: tool('tool-2') },
        { id: 'text-1', kind: 'text', text: 'middle' },
        { id: 'tool-3', kind: 'tool', tool: tool('tool-3') },
      ],
    })

    expect(html.match(/data-kind="tools"/g)).toHaveLength(2)
    expect(html).toContain('data-count="2"')
    expect(html).toContain('data-count="1"')
  })

  it('groups adjacent text parts into one Markdown render pass', () => {
    const html = render({
      id: 'assistant-1',
      role: 'assistant',
      content: '**Bold**',
      orderedParts: [
        { id: 'text-1', kind: 'text', text: '**Bo' },
        { id: 'text-2', kind: 'text', text: 'ld**' },
      ],
    })

    expect(html.match(/data-kind="markdown"/g)).toHaveLength(1)
    expect(html).toContain('**Bold**')
  })
})
