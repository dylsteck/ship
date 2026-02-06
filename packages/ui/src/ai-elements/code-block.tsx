'use client'

import * as React from 'react'
import { cn } from '../utils'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({ code, language = 'text', className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('rounded-lg overflow-hidden border border-border/40 bg-[#f8f9fa] dark:bg-[#1a1b1e] my-3', className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 dark:bg-muted/20 border-b border-border/30">
        <span className="text-[11px] font-medium text-muted-foreground/70 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className={cn(
            'text-[11px] px-2 py-0.5 rounded-md transition-all font-medium',
            copied
              ? 'text-green-600 dark:text-green-400'
              : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50',
          )}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-[1.6]">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  )
}
