'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Settings01Icon,
  Logout01Icon,
  Cancel01Icon,
  Add01Icon,
} from '@hugeicons/core-free-icons'
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@ship/ui'
import { ChatSearchCommand } from './chat-search-command'
import { ClientOnly } from './client-only'
import { getSessionDisplayTitle } from '@/lib/session-display'

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

// List filter icon (lucide-list-filter)
function ListFilterIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
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

function SessionItem({
  session,
  currentSessionId,
  currentSessionTitle,
  isStreaming,
  deletingSessionId,
  onDelete,
}: {
  session: ChatSession
  currentSessionId?: string
  currentSessionTitle?: string
  isStreaming: boolean
  deletingSessionId: string | null
  onDelete: (session: ChatSession) => void
}) {
  const isCurrent = currentSessionId === session.id
  const isCurrentAndStreaming = isStreaming && isCurrent
  const displayTitle = getSessionDisplayTitle(session, {
    preferredTitle: isCurrent ? currentSessionTitle : undefined,
  }) || session.repoName

  return (
    <div className="relative group/item">
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
            <span className={cn('text-xs truncate', isCurrent ? 'font-medium' : 'font-normal')}>{displayTitle}</span>
            <span className="text-[10px] text-muted-foreground/40 shrink-0">
              {formatRelativeTime(session.lastActivity)}
            </span>
          </div>
        </div>
      </Link>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100">
        <button
          type="button"
          title="Delete session"
          disabled={deletingSessionId === session.id}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(session)
          }}
          className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 text-muted-foreground/60 hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
        </button>
      </div>
    </div>
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
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { deleteSession } = useDeleteSession()
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
  const [groupBy, setGroupBy] = useState<'none' | 'project' | 'date' | 'status'>('none')
  const [compact, setCompact] = useState(true)

  const groupByRepo = groupBy === 'project'

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
    <Sidebar collapsible="offcanvas" className={className}>
      {/* Header: logo + search + sidebar trigger */}
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden hover:opacity-80 transition-opacity"
          >
            Ship
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="size-5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
              title="Search (⌘K)"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
            </button>
            <SidebarTrigger className="size-5 cursor-pointer text-muted-foreground hover:text-foreground" />
          </div>
        </div>
      </SidebarHeader>

      {/* Top nav: New Chat + feature items */}
      <div className="px-2 pt-3 pb-1">
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
            <SidebarMenuButton render={<button type="button" />}>
              <svg className="size-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Automations
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<button type="button" />}>
              <svg className="size-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <path d="M12 8v3M7.5 17.2 10.5 11M16.5 17.2 13.5 11" />
              </svg>
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Swarm
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<button type="button" />}>
              <svg className="size-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Dashboard
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Sessions header with filter dropdown */}
        <div className="px-3 py-2 flex items-center justify-between group-data-[collapsible=icon]:hidden">
          <span className="text-[11px] font-medium text-muted-foreground/60">Agents</span>
          <ClientOnly
            fallback={
              <button
                type="button"
                className="p-1 rounded text-muted-foreground/40"
                aria-label="Filter"
              >
                <ListFilterIcon className="size-3.5 text-muted-foreground" />
              </button>
            }
          >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    'p-1 rounded transition-colors cursor-pointer',
                    groupByRepo
                      ? 'bg-sidebar-accent text-foreground'
                      : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-sidebar-accent/50',
                  )}
                  title="Filter"
                  aria-label="Filter and group options"
                >
                  <ListFilterIcon className="size-3.5 text-muted-foreground" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Group</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                <DropdownMenuRadioItem value="project" className="cursor-pointer">
                  Project
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date" className="cursor-pointer">
                  Date
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="status" className="cursor-pointer">
                  Status
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none" className="cursor-pointer">
                  None
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={compact}
                onCheckedChange={(v) => setCompact(v === true)}
                className="cursor-pointer"
              >
                Compact
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </ClientOnly>
        </div>

        {/* Sessions list */}
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          {groupByRepo ? (
            /* Grouped by repo view */
            repoEntries.map(([repoKey, repoSessions]) => {
              const isExpanded = !collapsedRepos.has(repoKey)
              const repoName = repoKey.split('/')[1] ?? repoKey

              return (
                <div key={repoKey} className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleRepo(repoKey)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-accent transition-colors group/repo"
                  >
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground/60 group-hover/repo:text-muted-foreground transition-colors" />
                    <span className="text-xs font-medium text-muted-foreground flex-1 truncate">{repoName}</span>
                    <span className="text-[10px] text-muted-foreground/40">{repoSessions.length}</span>
                    <ChevronIcon
                      className={cn(
                        'size-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-150',
                        isExpanded ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/60 space-y-0.5">
                      {repoSessions
                        .sort((a, b) => b.lastActivity - a.lastActivity)
                        .map((session) => (
                          <SessionItem
                            key={session.id}
                            session={session}
                            currentSessionId={currentSessionId}
                            currentSessionTitle={currentSessionTitle}
                            isStreaming={isStreaming}
                            deletingSessionId={deletingSessionId}
                            onDelete={handleDeleteSession}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            /* Flat list view */
            <div className="space-y-0.5">
              {nonArchived
                .sort((a, b) => b.lastActivity - a.lastActivity)
                .map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    currentSessionId={currentSessionId}
                    currentSessionTitle={currentSessionTitle}
                    isStreaming={isStreaming}
                    deletingSessionId={deletingSessionId}
                    onDelete={handleDeleteSession}
                  />
                ))}
            </div>
          )}
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
                          {getSessionDisplayTitle(session, {
                            fallbackTitle: `${session.repoOwner}/${session.repoName}`,
                          })}
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <span>Appearance</span>
                  <span className="ml-auto text-muted-foreground capitalize">
                    {mounted && typeof theme === 'string' ? theme : 'System'}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={mounted && theme ? theme : 'system'}
                    onValueChange={(v) => setTheme(v)}
                  >
                    <DropdownMenuRadioItem value="system" className="cursor-pointer">
                      System
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="light" className="cursor-pointer">
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                      Dark
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
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
