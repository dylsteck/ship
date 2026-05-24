'use client'

import { memo, useMemo } from 'react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { cn } from '@ship/ui'
import type { Components } from 'react-markdown'
import type { ControlsConfig, MermaidErrorComponentProps } from 'streamdown'

import { normalizeMermaidCodeBlocks } from '@/lib/markdown-mermaid'

interface MarkdownProps {
  content: string
  className?: string
  /**
   * `true` while the underlying message is still streaming. Drives both the
   * Streamdown `mode` and the per-token fade-in animation so newly arrived
   * tokens fade in instead of popping into place.
   */
  isAnimating?: boolean
}

/**
 * Fade-in animation applied to newly arrived tokens during streaming.
 *
 * Same constants as vercel-labs/open-agents — chosen to feel like a smooth
 * stream rather than a series of punctual paints. Defined at module scope
 * so React can memoize the component over `content` alone.
 */
const STREAMING_ANIMATION = { animation: 'fadeIn', duration: 250, easing: 'ease-out' } as const

// Stable references — hoisted outside component to avoid re-creating on every render
const PLUGINS = { code, mermaid } as never

const MERMAID_OPTIONS = { errorComponent: MermaidErrorFallback }
const STREAMDOWN_CONTROLS: ControlsConfig = {
  code: { copy: true, download: false },
  mermaid: { copy: true, download: false, fullscreen: true, panZoom: true },
  table: { copy: true, download: false, fullscreen: true },
}

const customComponents: Components = {
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary/60"
        {...props}
      >
        {children}
      </a>
    )
  },
  h1({ children }) {
    return (
      <h1 className="mb-4 mt-6 first:mt-0 text-[1.35em] font-semibold leading-tight text-foreground">
        {children}
      </h1>
    )
  },
  h2({ children }) {
    return (
      <h2 className="mb-3 mt-5 first:mt-0 text-[1.15em] font-semibold leading-tight text-foreground">
        {children}
      </h2>
    )
  },
  h3({ children }) {
    return (
      <h3 className="mb-2 mt-4 first:mt-0 text-[1.05em] font-semibold leading-tight text-foreground">
        {children}
      </h3>
    )
  },
  h4({ children }) {
    return (
      <h4 className="mb-2 mt-3 first:mt-0 text-sm font-semibold text-foreground">{children}</h4>
    )
  },
  p({ children }) {
    return <p className="mb-3 last:mb-0 leading-[1.7] text-foreground">{children}</p>
  },
  ul({ children }) {
    return (
      <ul className="mb-3 ml-5 list-disc space-y-1.5 text-foreground [&>li]:pl-1">{children}</ul>
    )
  },
  ol({ children }) {
    return (
      <ol className="mb-3 ml-5 list-decimal space-y-1.5 text-foreground [&>li]:pl-1">{children}</ol>
    )
  },
  li({ children }) {
    return (
      <li className="leading-[1.65] text-foreground marker:text-muted-foreground/50">{children}</li>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-[3px] border-muted-foreground/20 pl-4 text-muted-foreground [&>p]:mb-1">
        {children}
      </blockquote>
    )
  },
  hr() {
    return <hr className="my-5 border-border/50" />
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
        <table className="min-w-full divide-y divide-border/50">{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className="bg-muted/40">{children}</thead>
  },
  tbody({ children }) {
    return <tbody className="divide-y divide-border/30">{children}</tbody>
  },
  tr({ children }) {
    return <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
  },
  th({ children }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{children}</th>
    )
  },
  td({ children }) {
    return <td className="px-3 py-2 text-sm text-foreground">{children}</td>
  },
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>
  },
  em({ children }) {
    return <em className="italic">{children}</em>
  },
  del({ children }) {
    return <del className="text-muted-foreground line-through">{children}</del>
  },
}

export const Markdown = memo(function Markdown({ content, className, isAnimating = false }: MarkdownProps) {
  const normalizedContent = useMemo(() => normalizeMermaidCodeBlocks(content), [content])

  return (
    <div className={cn('text-[14.5px] max-w-none break-words leading-relaxed [contain:layout_style]', className)}>
      <Streamdown
        plugins={PLUGINS}
        components={customComponents}
        mermaid={MERMAID_OPTIONS}
        controls={STREAMDOWN_CONTROLS}
        mode="static"
        isAnimating={isAnimating}
        animated={isAnimating ? STREAMING_ANIMATION : undefined}
      >
        {normalizedContent}
      </Streamdown>
    </div>
  )
})

function MermaidErrorFallback({ chart, error }: MermaidErrorComponentProps) {
  return (
    <div className="my-3 rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-foreground">
      <p className="mb-2 font-medium">Unable to render Mermaid diagram</p>
      <p className="mb-3 text-muted-foreground">{error}</p>
      <details>
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Show source
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-background p-3 text-xs leading-relaxed text-muted-foreground">
          {chart}
        </pre>
      </details>
    </div>
  )
}
