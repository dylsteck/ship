'use client'

import { SidebarProvider, SidebarInset } from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'

export interface DashboardLayoutSidebarProps {
  sessions: ChatSession[]
  user: User
  searchQuery: string
  onSearchChange: (value: string) => void
  currentSessionId?: string
  currentSessionTitle?: string
  onSessionDeleted: (id: string) => void
  onSessionDeleteFailed?: (session: ChatSession) => void
  onNewChat: () => void
  isStreaming: boolean
  streamingSessionIds?: Set<string>
}

export interface DashboardLayoutProps {
  defaultOpen: boolean
  sidebarProps: DashboardLayoutSidebarProps
  children: React.ReactNode
}

/**
 * Layout shell: SidebarProvider, AppSidebar, SidebarInset.
 * Children render inside SidebarInset (main column + right sidebar).
 */
export function DashboardLayout({
  defaultOpen,
  sidebarProps,
  children,
}: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        className="hidden md:block"
        sessions={sidebarProps.sessions}
        user={sidebarProps.user}
        searchQuery={sidebarProps.searchQuery}
        onSearchChange={sidebarProps.onSearchChange}
        currentSessionId={sidebarProps.currentSessionId}
        currentSessionTitle={sidebarProps.currentSessionTitle}
        onSessionDeleted={sidebarProps.onSessionDeleted}
        onSessionDeleteFailed={sidebarProps.onSessionDeleteFailed}
        onNewChat={sidebarProps.onNewChat}
        isStreaming={sidebarProps.isStreaming}
        streamingSessionIds={sidebarProps.streamingSessionIds}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
