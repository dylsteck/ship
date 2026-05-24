'use client'

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'

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

export function ChatSearchSessionGroups({
  sessions,
  currentSessionId,
  currentSessionTitle,
  onNavigate,
  newAgentIcon,
}: {
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
  onNavigate: (path: string) => void
  newAgentIcon: React.ReactNode
}) {
  const active = sessions.filter((s) => !s.archivedAt)
  const archived = sessions.filter((s) => !!s.archivedAt)

  return (
    <>
      <CommandGroup heading="Actions">
        <CommandItem onSelect={() => onNavigate('/')}>
          {newAgentIcon}
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
                    onSelect={() => onNavigate(`/session/${session.id}`)}
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
                    onSelect={() => onNavigate(`/session/${session.id}`)}
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
    </>
  )
}
