'use client'

import { useState, useTransition } from 'react'
import { Button, Badge, cn } from '@ship/ui'
import { useConnectors, useEnableConnector, useDisableConnector } from '@/lib/api/hooks/use-connectors'
import type { Connector } from '@/lib/api/types'

export function ConnectorSettings() {
  const { connectors, isLoading, mutate } = useConnectors(true)
  const { enableConnector } = useEnableConnector()
  const { disableConnector } = useDisableConnector()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleToggle = (name: string, nextEnabled: boolean) => {
    startTransition(async () => {
      try {
        setError(null)
        if (nextEnabled) {
          await enableConnector({ name })
        } else {
          await disableConnector({ name })
        }
        await mutate()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed')
      }
    })
  }

  const handleConnect = (name: Connector['name']) => {
    if (name === 'github') window.location.href = '/api/auth/github'
  }

  const names: Record<string, string> = { github: 'GitHub' }
  const descriptions: Record<string, string> = {
    github: 'Repository access and pull requests',
  }

  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin" />
        Loading...
      </div>
    )
  }

  const list = connectors.length > 0 ? connectors : [{ name: 'github', connected: false, enabled: false }]

  return (
    <div className="divide-y divide-border">
      {error && (
        <div className="px-4 py-2 bg-destructive/10">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {list.map((connector) => (
        <div key={connector.name} className="px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{names[connector.name] ?? connector.name}</p>
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
                : descriptions[connector.name] ?? ''}
            </p>
          </div>
          <div className="shrink-0">
            {connector.tokenExpired ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleConnect(connector.name)}
                disabled={isPending}
                className="h-8 text-xs"
              >
                Re-connect
              </Button>
            ) : connector.connected ? (
              <button
                type="button"
                onClick={() => handleToggle(connector.name, !connector.enabled)}
                disabled={isPending}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  connector.enabled ? 'bg-foreground' : 'bg-muted-foreground/30',
                )}
                aria-label={connector.enabled ? 'Disable' : 'Enable'}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
                    connector.enabled && 'translate-x-4',
                  )}
                />
              </button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleConnect(connector.name)}
                disabled={isPending}
                className="h-8 text-xs"
              >
                Connect
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
