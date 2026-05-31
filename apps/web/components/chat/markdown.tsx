'use client'

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid as mermaidPlugin } from '@streamdown/mermaid'
import { cn } from '@ship/ui'
import type { Components } from 'react-markdown'
import type { ControlsConfig, MermaidErrorComponentProps } from 'streamdown'

import { normalizeMermaidCodeBlocks } from '@/lib/markdown-mermaid'
import { STREAMING_TEXT_PACE_MS, getNextPacedText } from '@/lib/streaming-text-pacing'
import { MermaidBlockRenderer } from './mermaid-block'

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
const PLUGINS = {
  code,
  mermaid: mermaidPlugin,
  renderers: [{ language: 'mermaid', component: MermaidBlockRenderer }],
} as never

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
      <h1 className="mb-4 mt-6 first:mt-0 text-[1.35em] font-semibold leading-tight text-foreground">{children}</h1>
    )
  },
  h2({ children }) {
    return (
      <h2 className="mb-3 mt-5 first:mt-0 text-[1.15em] font-semibold leading-tight text-foreground">{children}</h2>
    )
  },
  h3({ children }) {
    return (
      <h3 className="mb-2 mt-4 first:mt-0 text-[1.05em] font-semibold leading-tight text-foreground">{children}</h3>
    )
  },
  h4({ children }) {
    return <h4 className="mb-2 mt-3 first:mt-0 text-sm font-semibold text-foreground">{children}</h4>
  },
  p({ children }) {
    return <p className="mb-3 last:mb-0 leading-[1.7] text-foreground">{children}</p>
  },
  ul({ children }) {
    return <ul className="mb-3 ml-5 list-disc space-y-1.5 text-foreground [&>li]:pl-1">{children}</ul>
  },
  ol({ children }) {
    return <ol className="mb-3 ml-5 list-decimal space-y-1.5 text-foreground [&>li]:pl-1">{children}</ol>
  },
  li({ children }) {
    return <li className="leading-[1.65] text-foreground marker:text-muted-foreground/50">{children}</li>
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
      <div className="my-3 max-w-full overflow-x-auto rounded-md border border-border/60 bg-background/40">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className="bg-muted/35">{children}</thead>
  },
  tbody({ children }) {
    return <tbody>{children}</tbody>
  },
  tr({ children }) {
    return <tr className="transition-colors hover:bg-muted/15">{children}</tr>
  },
  th({ children }) {
    return (
      <th className="border-b border-border/60 px-3 py-2 text-left text-xs font-medium text-muted-foreground first:pl-3 last:pr-3">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border-b border-border/35 px-3 py-2 align-top text-sm text-foreground last:pr-3 [&_code]:whitespace-normal">
        {children}
      </td>
    )
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
  const pacedContent = usePacedStreamingText(content, isAnimating)
  const normalizedContent = useMemo(() => normalizeMermaidCodeBlocks(pacedContent), [pacedContent])

  return (
    <div className={cn('text-[14.5px] max-w-none break-words leading-relaxed [contain:layout_style]', className)}>
      <Streamdown
        plugins={PLUGINS}
        components={customComponents}
        mermaid={MERMAID_OPTIONS}
        controls={STREAMDOWN_CONTROLS}
        mode={isAnimating ? 'streaming' : 'static'}
        isAnimating={isAnimating}
        animated={isAnimating ? STREAMING_ANIMATION : undefined}
      >
        {normalizedContent}
      </Streamdown>
    </div>
  )
})

function usePacedStreamingText(text: string, isStreaming: boolean): string {
  const initialText = isStreaming ? '' : text
  const [visibleText, setVisibleText] = useState(initialText)
  const visibleTextRef = useRef(initialText)
  const latestTextRef = useRef(text)
  const isStreamingRef = useRef(isStreaming)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current == null) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  const syncVisibleText = useCallback((nextText: string) => {
    visibleTextRef.current = nextText
    setVisibleText(nextText)
  }, [])

  const runPaceTick = useCallback(() => {
    timeoutRef.current = null
    const nextText = getNextPacedText(latestTextRef.current, visibleTextRef.current, isStreamingRef.current)
    syncVisibleText(nextText)

    if (isStreamingRef.current && nextText.length < latestTextRef.current.length) {
      timeoutRef.current = setTimeout(runPaceTick, STREAMING_TEXT_PACE_MS)
    }
  }, [syncVisibleText])

  useEffect(() => {
    latestTextRef.current = text
    isStreamingRef.current = isStreaming

    if (!isStreaming) {
      clearTimer()
      syncVisibleText(text)
      return
    }

    if (!text.startsWith(visibleTextRef.current) || text.length < visibleTextRef.current.length) {
      clearTimer()
      syncVisibleText(text)
      return
    }

    if (text.length === visibleTextRef.current.length || timeoutRef.current != null) return
    timeoutRef.current = setTimeout(runPaceTick, STREAMING_TEXT_PACE_MS)
  }, [clearTimer, isStreaming, runPaceTick, syncVisibleText, text])

  useEffect(() => clearTimer, [clearTimer])

  return visibleText
}

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
