'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button, Badge, cn } from '@ship/ui'
import { API_URL } from '@/lib/config'

interface ConnectorStatus {
  name: 'github'
  connected: boolean
  enabled: boolean
}

export function ConnectorSettings({ userId }: { userId: string }) {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function loadConnectors() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/connectors?userId=${userId}`)
        if (!res.ok) throw new Error('Failed to fetch connectors')
        const data = await res.json()
        setConnectors(data.connectors || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    loadConnectors()
  }, [userId])

  const handleToggle = (name: ConnectorStatus['name'], enabled: boolean) => {
    startTransition(async () => {
      try {
        setError(null)
        const res = await fetch(`${API_URL}/connectors/${name}/${enabled ? 'enable' : 'disable'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        if (!res.ok) throw new Error('Failed')
        setConnectors((prev) => prev.map((c) => (c.name === name ? { ...c, enabled: !c.enabled } : c)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed')
      }
    })
  }

  const handleConnect = (name: ConnectorStatus['name']) => {
    if (name === 'github') window.location.href = '/api/auth/github'
  }

  const names: Record<string, string> = { github: 'GitHub' }
  const descriptions: Record<string, string> = {
    github: 'Repository access and pull requests',
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <div className="w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
        Loading...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2">
          <p className="text-[11px] text-destructive">{error}</p>
        </div>
      )}
      {connectors.map((connector) => (
        <div key={connector.name} className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-foreground">{names[connector.name]}</span>
              <Badge variant={connector.connected ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
                {connector.connected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{descriptions[connector.name]}</p>
          </div>
          <div className="ml-3">
            {connector.connected ? (
              <button
                onClick={() => handleToggle(connector.name, !connector.enabled)}
                disabled={isPending}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  connector.enabled ? 'bg-foreground' : 'bg-muted-foreground/30'
                )}
                aria-label={connector.enabled ? 'Disable' : 'Enable'}
              >
                <span className={cn(
                  'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
                  connector.enabled && 'translate-x-4'
                )} />
              </button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleConnect(connector.name)} disabled={isPending}>
                Connect
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
