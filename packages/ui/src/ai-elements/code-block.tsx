'use client'

import * as React from 'react'
import { cn } from '../utils'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

// Lazy-loaded Shiki highlighter singleton
let highlighterPromise: Promise<import('shiki').Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((mod) =>
      mod.createHighlighter({
        themes: ['github-dark'],
        langs: [
          'javascript',
          'typescript',
          'tsx',
          'jsx',
          'python',
          'json',
          'html',
          'css',
          'bash',
          'shell',
          'markdown',
          'yaml',
          'sql',
          'rust',
          'go',
          'diff',
          'toml',
        ],
      }),
    )
  }
  return highlighterPromise
}

function useShikiHighlight(code: string, language: string) {
  const [html, setHtml] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return

        // Check if the language is supported, fallback to 'text' rendering
        const loadedLangs = highlighter.getLoadedLanguages()
        const lang = loadedLangs.includes(language as never) ? language : null

        if (lang) {
          const highlighted = highlighter.codeToHtml(code, {
            lang,
            theme: 'github-dark',
          })
          if (!cancelled) setHtml(highlighted)
        }
      })
      .catch(() => {
        // Silently fall back to plain text
      })

    return () => {
      cancelled = true
    }
  }, [code, language])

  return html
}

export function CodeBlock({ code, language = 'text', className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)
  const highlightedHtml = useShikiHighlight(code, language)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('group/codeblock relative rounded-lg overflow-hidden border border-border/30 bg-[#0d1117] my-3', className)}>
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-0 group-hover/codeblock:opacity-100 transition-opacity">
        {language && language !== 'text' && (
          <span className="text-[10px] text-muted-foreground/40 font-mono select-none">{language}</span>
        )}
        <button
          onClick={handleCopy}
          className={cn(
            'text-[11px] px-1.5 py-0.5 rounded transition-all font-medium',
            copied
              ? 'text-green-400'
              : 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-white/5',
          )}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {highlightedHtml ? (
        <div
          className="p-4 overflow-x-auto text-[13px] leading-[1.6] [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!font-mono"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="p-4 overflow-x-auto text-[13px] leading-[1.6]">
          <code className="font-mono text-[#e6edf3]">{code}</code>
        </pre>
      )}
    </div>
  )
}
