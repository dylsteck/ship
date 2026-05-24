'use client'

import { useState, useTransition } from 'react'
import { useConnectors, useEnableConnector, useDisableConnector } from '@/lib/api/hooks/use-connectors'
import type { Connector } from '@/lib/api/types'
import { ConnectorRow } from './connector-row'

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
        <ConnectorRow
          key={connector.name}
          connector={connector}
          isPending={isPending}
          onToggle={handleToggle}
          onConnect={handleConnect}
        />
      ))}
    </div>
  )
}
