'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button, Badge, cn } from '@ship/ui'
import { fetcher, post, API_URL } from '@/lib/api/client'

interface ConnectorStatus {
  name: 'github'
  connected: boolean
  enabled: boolean
  tokenExpired?: boolean
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
        const data = await fetcher<{ connectors: ConnectorStatus[] }>(
          `${API_URL}/connectors?userId=${userId}`,
        )
        setConnectors(data.connectors || [])
      } catch (err) {
        console.warn('Failed to fetch connectors:', err)
        setConnectors([{ name: 'github', connected: false, enabled: false }])
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
        await post<{ userId: string }, { success: boolean }>(
          `${API_URL}/connectors/${name}/${enabled ? 'enable' : 'disable'}`,
          { userId },
        )
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
      <div className="px-4 py-4 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {error && (
        <div className="px-4 py-2 bg-destructive/10">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {connectors.map((connector) => (
        <div key={connector.name} className="px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{names[connector.name]}</p>
              {connector.tokenExpired ? (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                  Token Expired
                </Badge>
              ) : (
                <Badge variant={connector.connected ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
                  {connector.connected ? 'Connected' : 'Not Connected'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {connector.tokenExpired
                ? 'Your token has expired. Re-connect to restore access.'
                : descriptions[connector.name]}
            </p>
          </div>
          <div className="shrink-0">
            {connector.tokenExpired ? (
              <Button size="sm" variant="outline" onClick={() => handleConnect(connector.name)} disabled={isPending} className="h-8 text-xs">
                Re-connect
              </Button>
            ) : connector.connected ? (
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
              <Button size="sm" variant="outline" onClick={() => handleConnect(connector.name)} disabled={isPending} className="h-8 text-xs">
                Connect
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
