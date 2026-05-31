'use client'

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid as mermaidPlugin } from '@streamdown/mermaid'
import { cn } from '@ship/ui'
import type { Components } from 'react-markdown'
import type { ControlsConfig, MermaidErrorComponentProps } from 'streamdown'

import { normalizeChatMarkdown } from '@/lib/markdown-normalize'
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
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  },
  table({ children }) {
    return (
      <div className="ship-markdown-table-scroll">
        <table>{children}</table>
      </div>
    )
  },
}

export const Markdown = memo(function Markdown({ content, className, isAnimating = false }: MarkdownProps) {
  const pacedContent = usePacedStreamingText(content, isAnimating)
  const normalizedContent = useMemo(() => normalizeChatMarkdown(pacedContent), [pacedContent])

  return (
    <div
      className={cn(
        'ship-markdown max-w-none break-words text-[14px] leading-[1.62] text-foreground [contain:layout_style]',
        className,
      )}
    >
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
