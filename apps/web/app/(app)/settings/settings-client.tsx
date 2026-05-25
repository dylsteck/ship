'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { setApiToken } from '@/lib/api/configure'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useIsMobile, SidebarTrigger, useSidebar, cn } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon, ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import { MobileNav } from '../dashboard/components/dashboard-header'
import { useTheme } from '@/components/providers/theme-context'
import { useSessions } from '@/lib/api'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import { DashboardLayout } from '../dashboard/components/dashboard-layout'
import { DeleteAllSessionsCard } from './delete-all-sessions-card'

interface SettingsClientProps {
  user: User
  sidebarDefaultOpen: boolean
  sessions: ChatSession[]
  apiToken?: string
}

function SettingsSidebarTrigger() {
  const { state } = useSidebar()
  const isMobileTrigger = useIsMobile()
  if (state !== 'collapsed' && !isMobileTrigger) return null
  return (
    <div className="flex items-center gap-2 shrink-0">
      <SidebarTrigger className="size-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
      <Link
        href="/"
        className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        title="New Agent"
      >
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" />
      </Link>
    </div>
  )
}

/** Closes sidebar on initial mount only — must render inside SidebarProvider */
function SidebarAutoClose() {
  const { setOpen } = useSidebar()
  const hasClosed = useRef(false)
  useEffect(() => {
    if (!hasClosed.current) {
      setOpen(false)
      hasClosed.current = true
    }
  }, [setOpen])
  return null
}

export function SettingsClient({ user, sessions: initialSessions, apiToken, sidebarDefaultOpen }: SettingsClientProps) {
  if (apiToken) setApiToken(apiToken)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')
  const { theme, setTheme, themes } = useTheme()

  const { sessions: swrSessions } = useSessions(true, { refetchOnFocus: true })
  const sessions = swrSessions.length > 0 ? swrSessions : initialSessions

  const handleNewChat = useCallback(() => {
    router.push('/')
  }, [router])

  const handleSessionDeleted = useCallback((_id: string) => {
    router.refresh()
  }, [router])

  const settingsContent = (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {!isMobile && (
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3" />
          Back to Home
        </Link>
      )}

      <h1 className="text-2xl font-semibold text-foreground mb-10">Settings</h1>

      {/* Appearance */}
      <section className="mb-10">
        <h2 className="text-xs text-muted-foreground mb-3">Appearance</h2>
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Theme</span>
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs transition-colors',
                  theme === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'system' ? 'Auto' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="mb-10">
        <h2 className="text-xs text-muted-foreground mb-3">Integrations</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ConnectorSettings />
        </div>
      </section>

      {/* Data */}
      <section>
        <h2 className="text-xs text-muted-foreground mb-3">Data</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <DeleteAllSessionsCard />
        </div>
      </section>
    </div>
  )

  return (
    <DashboardLayout
      defaultOpen={sidebarDefaultOpen}
      sidebarProps={{
        sessions,
        user,
        searchQuery,
        onSearchChange: setSearchQuery,
        onSessionDeleted: handleSessionDeleted,
        onNewChat: handleNewChat,
        isStreaming: false,
      }}
    >
      <div className="min-h-screen relative">
        <SidebarAutoClose />
        <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pt-3 pb-1.5 relative z-10">
          <SettingsSidebarTrigger />
          <MobileNav activeSessionId={null} user={user} />
        </header>
        {settingsContent}
      </div>
    </DashboardLayout>
  )
}
