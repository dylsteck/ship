'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Refresh01Icon, Search01Icon, Settings01Icon, Logout01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { useDeleteSession, type ChatSession } from '@/lib/api'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuItem,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'

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
  onSessionDeleted?: (sessionId: string) => void
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export function AppSidebar({ sessions, user, searchQuery, onSearchChange, currentSessionId, onSessionDeleted }: AppSidebarProps) {
  const router = useRouter()
  const { deleteSession } = useDeleteSession()
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const filtered = sessions.filter(s => 
    searchQuery === '' || 
    s.repoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.repoOwner.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const activeSessions = filtered.filter(s => s.lastActivity > oneWeekAgo)
  const inactiveSessions = filtered.filter(s => s.lastActivity <= oneWeekAgo)

  const handleDeleteSession = async (session: ChatSession) => {
    const confirmed = window.confirm(`Delete session ${session.repoOwner}/${session.repoName}?`)
    if (!confirmed) return

    try {
      setDeletingSessionId(session.id)
      // Optimistically update UI immediately
      onSessionDeleted?.(session.id)
      await deleteSession({ sessionId: session.id })
      if (currentSessionId === session.id) {
        router.push('/')
        return
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      // Could add the session back on error, but for now just refresh
      router.refresh()
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-foreground rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-background" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">Ship</span>
          </div>
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => router.refresh()}>
              <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground cursor-pointer"
                    aria-label="Open user menu"
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} width={24} height={24} className="w-6 h-6 object-cover" />
                    ) : (
                      <span>{user.username[0].toUpperCase()}</span>
                    )}
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    router.push('/settings')
                  }}
                  className="cursor-pointer"
                >
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    window.location.href = '/api/auth/logout'
                  }}
                  className="cursor-pointer"
                >
                  <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarHeader>

      <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <SidebarInput
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      <SidebarContent>
        {activeSessions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-wide text-muted-foreground/70">Active</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {activeSessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton render={<Link href={`/session/${session.id}`} />} tooltip={`${session.repoOwner}/${session.repoName}`}>
                      <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                        <span className="text-xs font-medium truncate">{session.repoOwner}/{session.repoName}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(session.lastActivity)}</span>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      title="Delete session"
                      aria-label="Delete session"
                      disabled={deletingSessionId === session.id}
                      className="cursor-pointer disabled:opacity-50"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (deletingSessionId) return
                        handleDeleteSession(session)
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {inactiveSessions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-wide text-muted-foreground/70">Inactive</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {inactiveSessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton render={<Link href={`/session/${session.id}`} />} tooltip={`${session.repoOwner}/${session.repoName}`}>
                      <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                        <span className="text-xs font-medium truncate opacity-70">{session.repoOwner}/{session.repoName}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(session.lastActivity)}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {sessions.length === 0 && (
          <div className="py-6 text-center group-data-[collapsible=icon]:hidden">
            <p className="text-xs text-muted-foreground">No sessions yet</p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <div className="px-2 py-1 text-[10px] text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
