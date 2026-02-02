'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ChatSession } from '@/lib/api'
import { CreateSessionDialog } from '@/components/session/create-session-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface User {
  id: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function SessionItem({ session }: { session: ChatSession }) {
  return (
    <Link
      href={`/session/${session.id}`}
      className="block py-2 px-1 hover:bg-accent transition-colors rounded-sm group"
    >
      <p className="text-[13px] font-medium text-foreground truncate leading-tight">
        {session.repoOwner}/{session.repoName}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {formatRelativeTime(session.lastActivity)} · {session.repoName}
      </p>
    </Link>
  )
}

function AreaChart({ color = 'hsl(var(--chart-1))' }: { color?: string }) {
  const points = useMemo(() => {
    const data = [30, 35, 32, 40, 38, 45, 42, 50, 48, 55, 60, 65]
    return data.map((y, i) => `${(i / 11) * 100},${100 - y}`).join(' ')
  }, [])
  
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={`gradient-chart`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill="url(#gradient-chart)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3 relative overflow-hidden">
      <p className="text-[11px] text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className="text-xl font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </p>
      <div className="absolute bottom-0 left-0 right-0 h-10 opacity-80">
        <AreaChart />
      </div>
    </Card>
  )
}

export function DashboardClient({ sessions, userId, user }: DashboardClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const { activeSessions, inactiveSessions } = useMemo(() => {
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
    const filtered = sessions.filter(s => 
      searchQuery === '' || 
      s.repoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.repoOwner.toLowerCase().includes(searchQuery.toLowerCase())
    )
    return {
      activeSessions: filtered.filter(s => s.lastActivity > oneWeekAgo),
      inactiveSessions: filtered.filter(s => s.lastActivity <= oneWeekAgo),
    }
  }, [sessions, searchQuery])

  const handleCreate = async (data: { repoOwner: string; repoName: string; model?: string }) => {
    const res = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, repoOwner: data.repoOwner, repoName: data.repoName }),
    })
    if (!res.ok) throw new Error('Failed to create session')
    const newSession = await res.json()
    router.push(`/session/${newSession.id}`)
  }

  const stats = {
    sessionsThisWeek: activeSessions.length,
    totalSessions: sessions.length,
    reposUsed: new Set(sessions.map(s => `${s.repoOwner}/${s.repoName}`)).size,
  }

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-[240px] bg-background border-r border-border flex flex-col">
        <div className="h-11 px-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-foreground rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-background" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-foreground">Ship</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.refresh()}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} width={24} height={24} className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                {user.username[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="px-3 py-2">
          <Input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-[12px] bg-transparent border-0 shadow-none px-0 focus-visible:ring-0"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {activeSessions.length > 0 && (
            <div className="pb-2">
              {activeSessions.map((session) => (
                <SessionItem key={session.id} session={session} />
              ))}
            </div>
          )}
          {inactiveSessions.length > 0 && (
            <>
              <p className="px-1 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Inactive</p>
              {inactiveSessions.map((session) => (
                <SessionItem key={session.id} session={session} />
              ))}
            </>
          )}
          {sessions.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[12px] text-muted-foreground">No sessions yet</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col relative">
        <div 
          className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }}
        />

        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-[520px] space-y-5">
            <Card
              className="cursor-pointer hover:border-ring/50 transition-colors"
              role="button"
              tabIndex={0}
              onClick={() => setIsDialogOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDialogOpen(true) }}}
            >
              <div className="px-3 pt-3 pb-2">
                <p className="text-[14px] text-muted-foreground">Ask or build anything</p>
              </div>
              <div className="px-3 pb-2 flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Select repo</span>
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="px-3 py-2 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">claude opus 4.5</span>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">build agent</Badge>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <StatsCard label="Active sessions" value={stats.sessionsThisWeek} />
              <StatsCard label="Total sessions" value={stats.totalSessions} />
              <StatsCard label="Repos used" value={stats.reposUsed} />
            </div>
          </div>
        </div>

        <div className="py-2 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{user.username} connected</span>
          </div>
        </div>
      </main>

      <CreateSessionDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onCreate={handleCreate} userId={userId} />
    </div>
  )
}
