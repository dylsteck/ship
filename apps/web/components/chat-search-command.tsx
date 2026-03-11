'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@ship/ui'
import type { ChatSession } from '@/lib/api'

interface ChatSearchCommandProps {
  open: boolean
  onClose: () => void
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  const days = Math.floor(seconds / 86400)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
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

  const active = sessions.filter((s) => !s.archivedAt)
  const archived = sessions.filter((s) => !!s.archivedAt)

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="relative w-full max-w-lg mx-4 bg-popover rounded-xl border border-border/60 shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        <Command loop>
          <CommandInput placeholder="Search agents..." autoFocus />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  router.push('/')
                  onClose()
                }}
              >
                <NewAgentIcon className="size-4 shrink-0 text-muted-foreground/60" />
                <span>New Agent</span>
              </CommandItem>
            </CommandGroup>

            {active.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Chats">
                  {active
                    .sort((a, b) => b.lastActivity - a.lastActivity)
                    .map((session) => {
                      const title =
                        currentSessionId === session.id
                          ? (currentSessionTitle || session.title || session.repoName)
                          : (session.title || session.repoName)
                      const sub = `${session.repoOwner}/${session.repoName}`
                      return (
                        <CommandItem
                          key={session.id}
                          value={`${title} ${sub}`}
                          onSelect={() => {
                            router.push(`/session/${session.id}`)
                            onClose()
                          }}
                          className={currentSessionId === session.id ? 'bg-accent' : ''}
                        >
                          <ChatIcon className="size-4 shrink-0 text-muted-foreground/50" />
                          <div className="flex-1 min-w-0">
                            <span className="truncate">{title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground/40 shrink-0">
                            {formatRelativeTime(session.lastActivity)}
                          </span>
                        </CommandItem>
                      )
                    })}
                </CommandGroup>
              </>
            )}

            {archived.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Archived">
                  {archived
                    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
                    .map((session) => {
                      const archivedTitle = session.title || session.repoName
                      return (
                      <CommandItem
                        key={session.id}
                        value={`${archivedTitle} ${session.repoOwner}/${session.repoName}`}
                        onSelect={() => {
                          router.push(`/session/${session.id}`)
                          onClose()
                        }}
                        className="opacity-50"
                      >
                        <ChatIcon className="size-4 shrink-0 text-muted-foreground/40" />
                        <span className="flex-1 truncate">{archivedTitle}</span>
                        <span className="text-xs text-muted-foreground/30 shrink-0">
                          {formatRelativeTime(session.archivedAt ?? session.lastActivity)}
                        </span>
                      </CommandItem>
                    )
                    })}
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Footer with keyboard shortcuts */}
          <div className="flex items-center gap-4 border-t border-border/30 px-4 py-2 text-[11px] text-muted-foreground/50">
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
        </Command>
      </div>
    </div>,
    document.body,
  )
}
