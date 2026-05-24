'use client'

import { Button, Badge, cn } from '@ship/ui'
import type { Connector } from '@/lib/api/types'

const connectorNames: Record<string, string> = { github: 'GitHub' }
const connectorDescriptions: Record<string, string> = {
  github: 'Repository access and pull requests',
}

function ConnectorRowActions({
  connector,
  isPending,
  onToggle,
  onConnect,
}: {
  connector: Connector
  isPending: boolean
  onToggle: (name: string, nextEnabled: boolean) => void
  onConnect: (name: Connector['name']) => void
}) {
  if (connector.tokenExpired) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => onConnect(connector.name)}
        disabled={isPending}
        className="h-8 text-xs"
      >
        Re-connect
      </Button>
    )
  }

  if (connector.connected) {
    return (
      <button
        type="button"
        onClick={() => onToggle(connector.name, !connector.enabled)}
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
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onConnect(connector.name)}
      disabled={isPending}
      className="h-8 text-xs"
    >
      Connect
    </Button>
  )
}

export function ConnectorRow({
  connector,
  isPending,
  onToggle,
  onConnect,
}: {
  connector: Connector
  isPending: boolean
  onToggle: (name: string, nextEnabled: boolean) => void
  onConnect: (name: Connector['name']) => void
}) {
  return (
    <div className="px-4 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{connectorNames[connector.name] ?? connector.name}</p>
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
            : connectorDescriptions[connector.name] ?? ''}
        </p>
      </div>
      <div className="shrink-0">
        <ConnectorRowActions
          connector={connector}
          isPending={isPending}
          onToggle={onToggle}
          onConnect={onConnect}
        />
      </div>
    </div>
  )
}
