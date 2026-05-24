'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Cancel01Icon, Copy01Icon, FullScreenIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@ship/ui'
import { copyPlainText } from './clipboard'

type CopyState = 'idle' | 'copied' | 'blocked'

interface MermaidActionsProps {
  chart: string
  onClose?: () => void
  onFullscreen?: () => void
}

/** Renders Mermaid header actions with clipboard fallback status. */
export function MermaidActions({ chart, onClose, onFullscreen }: MermaidActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  useEffect(() => {
    if (copyState === 'idle') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 1800)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  const handleCopy = () => {
    void copyPlainText(chart)
      .then((copied) => setCopyState(copied ? 'copied' : 'blocked'))
      .catch(() => setCopyState('blocked'))
  }

  return (
    <div className="flex items-center gap-2">
      <CopyStatus state={copyState} />
      <div className="flex items-center gap-1">
        <ActionButton label="Copy Mermaid source" onClick={handleCopy}>
          <HugeiconsIcon icon={Copy01Icon} size={18} strokeWidth={1.8} />
        </ActionButton>
        {onFullscreen ? (
          <ActionButton label="Open Mermaid fullscreen" onClick={onFullscreen}>
            <HugeiconsIcon icon={FullScreenIcon} size={18} strokeWidth={1.8} />
          </ActionButton>
        ) : null}
        {onClose ? (
          <ActionButton label="Close fullscreen" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} />
          </ActionButton>
        ) : null}
      </div>
    </div>
  )
}

function CopyStatus({ state }: { state: CopyState }) {
  if (state === 'idle') return null

  return (
    <span
      aria-live="polite"
      className={cn('whitespace-nowrap text-xs', state === 'copied' ? 'text-muted-foreground' : 'text-destructive')}
    >
      {state === 'copied' ? 'Copied' : 'Copy blocked'}
    </span>
  )
}

interface ActionButtonProps {
  children: ReactNode
  label: string
  onClick: () => void
}

function ActionButton({ children, label, onClick }: ActionButtonProps) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}
