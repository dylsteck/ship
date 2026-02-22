'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Settings01Icon, Logout01Icon, Cancel01Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { useDeleteSession, type ChatSession } from '@/lib/api'
import { cn } from '@ship/ui/utils'
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ship/ui'
import { ChatSearchCommand } from './chat-search-command'
import { ClientOnly } from './client-only'

interface User {
  id: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}

interface AppSidebarProps {
  sessions: ChatSession[]
  user: User
  searchQuery: string
  onSearchChange: (value: string) => void
  currentSessionId?: string
  currentSessionTitle?: string
  onSessionDeleted?: (sessionId: string) => void
  onNewChat?: () => void
  isStreaming?: boolean
  className?: string
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

// Folder SVG icon
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L10.707 6.7A1 1 0 0 0 11.414 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

// Chevron SVG
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function AppSidebar({
  sessions,
  user,
  searchQuery,
  onSearchChange,
  currentSessionId,
  currentSessionTitle,
  onSessionDeleted,
  onNewChat,
  isStreaming = false,
  className,
}: AppSidebarProps) {
  const router = useRouter()
  const { deleteSession } = useDeleteSession()
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // collapsedRepos: keys of repos that are manually collapsed (default = all expanded)
  const [collapsedRepos, setCollapsedRepos] = useState<Set<string>>(new Set())
  const [archiveExpanded, setArchiveExpanded] = useState(false)

  const toggleRepo = (key: string) => {
    setCollapsedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Filter by search query
  const filtered = sessions.filter(
    (s) =>
      searchQuery === '' ||
      s.repoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.repoOwner.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Split into non-archived and archived
  const nonArchived = filtered.filter((s) => !s.archivedAt)
  const archived = filtered.filter((s) => !!s.archivedAt)

  // Group non-archived by repo, sorted by most recent activity
  const byRepo: Record<string, ChatSession[]> = {}
  for (const session of nonArchived) {
    const key = `${session.repoOwner}/${session.repoName}`
    if (!byRepo[key]) byRepo[key] = []
    byRepo[key].push(session)
  }
  const repoEntries = Object.entries(byRepo).sort(
    ([, a], [, b]) => Math.max(...b.map((s) => s.lastActivity)) - Math.max(...a.map((s) => s.lastActivity)),
  )

  const handleDeleteSession = async (session: ChatSession) => {
    try {
      setDeletingSessionId(session.id)
      await deleteSession({ sessionId: session.id })
      onSessionDeleted?.(session.id)
      if (currentSessionId === session.id) {
        router.push('/')
        window.location.href = '/'
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      router.refresh()
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <Sidebar collapsible="icon" className={className}>
      {/* Header: logo + sidebar trigger */}
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden hover:opacity-80 transition-opacity"
          >
            Ship
          </Link>
          <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
        </div>
      </SidebarHeader>

      {/* Top nav: New Chat + Search */}
      <div className="px-2 pt-3 pb-1 space-y-0.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<button type="button" onClick={() => (onNewChat ? onNewChat() : router.push('/'))} />}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 text-muted-foreground/50 shrink-0" />
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                New chat
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setSearchOpen(true)}>
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4 text-muted-foreground/50" />
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Search
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Repo-grouped sessions */}
        <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
          {repoEntries.map(([repoKey, repoSessions]) => {
            const isExpanded = !collapsedRepos.has(repoKey)
            const repoName = repoKey.split('/')[1] ?? repoKey

            return (
              <div key={repoKey} className="mb-1">
                {/* Repo header */}
                <button
                  type="button"
                  onClick={() => toggleRepo(repoKey)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-accent transition-colors group/repo"
                >
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground/60 group-hover/repo:text-muted-foreground transition-colors" />
                  <span className="text-xs font-medium text-muted-foreground flex-1 truncate">{repoName}</span>
                  <ChevronIcon
                    className={cn(
                      'size-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-150',
                      isExpanded ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                </button>

                {/* Sessions under this repo */}
                {isExpanded && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/60">
                    {repoSessions
                      .sort((a, b) => b.lastActivity - a.lastActivity)
                      .map((session) => {
                        const isCurrent = currentSessionId === session.id
                        const isCurrentAndStreaming = isStreaming && isCurrent
                        const sessionTitle =
                          isCurrent && currentSessionTitle ? currentSessionTitle : session.title || null
                        const displayTitle = sessionTitle || session.repoName
                        const tooltipText = sessionTitle || `${session.repoOwner}/${session.repoName}`

                        return (
                          <div key={session.id} className="relative group/item">
                            <Link
                              href={`/session/${session.id}`}
                              className={cn(
                                'flex items-center gap-2 py-1.5 pr-6 pl-2 rounded-md text-left w-full transition-colors',
                                isCurrent
                                  ? 'bg-sidebar-accent text-foreground'
                                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                              )}
                            >
                              {isCurrentAndStreaming && (
                                <span className="shrink-0 w-2.5 h-2.5 border-[1.5px] border-primary/30 border-t-primary rounded-full animate-spin" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className={cn('text-xs truncate', isCurrent ? 'font-medium' : 'font-normal')}>
                                    {displayTitle}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/40 shrink-0">
                                    {formatRelativeTime(session.lastActivity)}
                                  </span>
                                </div>
                              </div>
                            </Link>
                            {/* Delete action */}
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100">
                              <button
                                type="button"
                                title="Delete session"
                                disabled={deletingSessionId === session.id}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDeleteSession(session)
                                }}
                                className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 text-muted-foreground/60 hover:text-foreground"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Archive section */}
        {archived.length > 0 && (
          <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
            <div className="mt-2 pt-2 border-t border-sidebar-border/40">
              <button
                type="button"
                onClick={() => setArchiveExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-accent transition-colors"
              >
                <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 flex-1">
                  Archived
                </span>
                <ChevronIcon
                  className={cn(
                    'size-3 text-muted-foreground/30 transition-transform duration-150',
                    archiveExpanded ? 'rotate-0' : '-rotate-90',
                  )}
                />
              </button>

              {archiveExpanded && (
                <div className="mt-1 space-y-0.5">
                  {archived
                    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
                    .map((session) => (
                      <Link
                        key={session.id}
                        href={`/session/${session.id}`}
                        className="flex items-baseline justify-between gap-2 px-2 py-1.5 rounded-md text-muted-foreground/50 hover:bg-sidebar-accent hover:text-muted-foreground transition-colors"
                      >
                        <span className="text-xs truncate">
                          {session.repoOwner}/{session.repoName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/30 shrink-0">
                          {formatRelativeTime(session.archivedAt ?? session.lastActivity)}
                        </span>
                      </Link>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SidebarFooter className="group-data-[collapsible=icon]:border-0 border-t border-sidebar-border">
        <ClientOnly
          fallback={
            <a
              href="/settings"
              className="w-full flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer outline-none group-data-[collapsible=icon]:justify-center"
              aria-label="Open user menu"
            >
              <span className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    width={24}
                    height={24}
                    className="w-6 h-6 object-cover"
                  />
                ) : (
                  <span>{user.username[0].toUpperCase()}</span>
                )}
              </span>
              <span className="text-sm font-normal text-foreground/80 truncate group-data-[collapsible=icon]:hidden">
                {user.name || user.username}
              </span>
            </a>
          }
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className="w-full flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer outline-none group-data-[collapsible=icon]:justify-center"
                  aria-label="Open user menu"
                >
                  <span className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        width={24}
                        height={24}
                        className="w-6 h-6 object-cover"
                      />
                    ) : (
                      <span>{user.username[0].toUpperCase()}</span>
                    )}
                  </span>
                  <span className="text-sm font-normal text-foreground/80 truncate group-data-[collapsible=icon]:hidden">
                    {user.name || user.username}
                  </span>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => (window.location.href = '/settings')} className="cursor-pointer">
                <HugeiconsIcon icon={Settings01Icon} className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = '/api/auth/logout'
                }}
                className="cursor-pointer text-red-600 dark:text-red-400"
              >
                <HugeiconsIcon icon={Logout01Icon} className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ClientOnly>
      </SidebarFooter>

      <ChatSearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
      />
    </Sidebar>
  )
}
