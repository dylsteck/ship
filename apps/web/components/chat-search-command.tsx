'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'
import { ChatSearchSessionGroups } from './chat-search-session-groups'

interface ChatSearchCommandProps {
  open: boolean
  onClose: () => void
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
}

function NewAgentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export function ChatSearchCommand({ open, onClose, sessions, currentSessionId, currentSessionTitle }: ChatSearchCommandProps) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const navigate = (path: string) => {
    router.push(path)
    onClose()
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[8vh] sm:pt-[15vh] bg-black/40 sm:bg-transparent"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="relative w-full max-w-lg mx-3 sm:mx-4 bg-popover rounded-xl border border-border/60 shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        <Command loop>
          <CommandInput placeholder="Search agents..." autoFocus />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <ChatSearchSessionGroups
              sessions={sessions}
              currentSessionId={currentSessionId}
              currentSessionTitle={currentSessionTitle}
              onNavigate={navigate}
              newAgentIcon={<NewAgentIcon className="size-4 shrink-0 text-muted-foreground/60" />}
            />
          </CommandList>
          <ChatSearchFooter />
        </Command>
      </div>
    </div>,
    document.body,
  )
}

function ChatSearchFooter() {
  return (
    <div className="hidden sm:flex items-center gap-4 border-t border-border/30 px-4 py-2 text-[11px] text-muted-foreground/50">
      <span className="flex items-center gap-1.5">
        <kbd className="inline-flex items-center justify-center rounded border border-border/40 bg-muted/50 px-1 py-0.5 font-mono text-[10px] leading-none">↑↓</kbd>
        Navigate
      </span>
      <span className="flex items-center gap-1.5">
        <kbd className="inline-flex items-center justify-center rounded border border-border/40 bg-muted/50 px-1 py-0.5 font-mono text-[10px] leading-none">↵</kbd>
        Select
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <kbd className="inline-flex items-center justify-center rounded border border-border/40 bg-muted/50 px-1 py-0.5 font-mono text-[10px] leading-none">Esc</kbd>
        Close
      </span>
    </div>
  )
}
