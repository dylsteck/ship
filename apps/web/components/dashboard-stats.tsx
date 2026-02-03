'use client'

import { useMemo } from 'react'
import { Card } from '@ship/ui'

function AreaChart({ color = 'var(--chart-1)' }: { color?: string }) {
  const points = useMemo(() => {
    const data = [30, 35, 32, 40, 38, 45, 42, 50, 48, 55, 60, 65]
    return data.map((y, i) => `${(i / 11) * 100},${100 - y}`).join(' ')
  }, [])

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="gradient-chart" x1="0%" y1="0%" x2="0%" y2="100%">
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
    <Card className="p-4 relative overflow-hidden">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </p>
      <div className="absolute bottom-0 left-0 right-0 h-12 opacity-80">
        <AreaChart />
      </div>
    </Card>
  )
}

export type DashboardStatsValue = {
  sessionsPastWeek: number
  messagesPastWeek: number
  activeRepos: number
}

export function DashboardStats({ stats }: { stats: DashboardStatsValue }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatsCard label="Sessions past week" value={stats.sessionsPastWeek} />
      <StatsCard label="Messages past week" value={stats.messagesPastWeek} />
      <StatsCard label="Active repos" value={stats.activeRepos} />
    </div>
  )
}
