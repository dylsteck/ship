'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Button } from '../button'

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
    <div className={cn('rounded-lg overflow-hidden border bg-muted/30 my-2', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <span className="text-xs font-medium text-muted-foreground uppercase">{language}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs">
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
