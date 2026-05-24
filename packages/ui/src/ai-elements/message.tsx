import * as React from 'react'
import { cn } from '../utils'

interface MessageProps {
  role: 'user' | 'assistant' | 'system'
  children: React.ReactNode
  className?: string
  timestamp?: Date
  copyContent?: string
}

function UserMessage({
  children,
  className,
  timeLabel,
  copyContent,
}: {
  children: React.ReactNode
  className?: string
  timeLabel: string | null
  copyContent?: string
}) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    if (!copyContent) return
    navigator.clipboard.writeText(copyContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <div className={cn('flex justify-end py-1', className)}>
      <div className="group max-w-[85%]">
        <div className="rounded-2xl bg-secondary/50 text-secondary-foreground px-4 py-2 md:rounded-full">
          <div className="text-sm">{children}</div>
        </div>
        {(timeLabel || copyContent) && (
          <div className="flex items-center justify-end gap-1.5 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50">
            {timeLabel && <span className="text-[10px]">{timeLabel}</span>}
            {copyContent && (
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-muted-foreground transition-colors"
                aria-label="Copy message"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function Message({ role, children, className, timestamp, copyContent }: MessageProps) {
  if (role === 'system') {
    return (
      <div className={cn('py-3', className)}>
        {children}
      </div>
    )
  }

  if (role === 'user') {
    const timeLabel = timestamp
      ? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null
    return <UserMessage className={className} timeLabel={timeLabel} copyContent={copyContent}>{children}</UserMessage>
  }

  // Assistant — flush left, no wrapper padding
  return (
    <div className={cn('py-4 space-y-3', className)}>
      {children}
    </div>
  )
}
