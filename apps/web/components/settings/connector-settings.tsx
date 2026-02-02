'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface ConnectorStatus {
  name: 'github' | 'linear' | 'vercel'
  connected: boolean
  enabled: boolean
}

interface ConnectorSettingsProps {
  userId: string
}

export function ConnectorSettings({ userId }: ConnectorSettingsProps) {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Fetch connector statuses
  useEffect(() => {
    async function loadConnectors() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/connectors?userId=${userId}`)
        if (!res.ok) throw new Error('Failed to fetch connectors')
        const data = await res.json()
        setConnectors(data.connectors || [])
      } catch (err) {
        console.error('Error loading connectors:', err)
        setError(err instanceof Error ? err.message : 'Failed to load connectors')
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
        const endpoint = enabled ? 'enable' : 'disable'
        const res = await fetch(`${API_URL}/connectors/${name}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })

        if (!res.ok) throw new Error(`Failed to ${endpoint} connector`)

        // Update local state
        setConnectors((prev) =>
          prev.map((c) => (c.name === name ? { ...c, enabled: !c.enabled } : c)),
        )
      } catch (err) {
        console.error(`Error toggling connector ${name}:`, err)
        setError(err instanceof Error ? err.message : 'Failed to update connector')
      }
    })
  }

  const handleConnect = (name: ConnectorStatus['name']) => {
    // Redirect to OAuth flow
    if (name === 'github') {
      window.location.href = '/api/auth/github'
    } else if (name === 'linear') {
      window.location.href = '/api/auth/linear'
    } else if (name === 'vercel') {
      // Vercel OAuth not implemented yet
      setError('Vercel OAuth not yet implemented')
    }
  }

  const handleDisconnect = async (name: ConnectorStatus['name']) => {
    startTransition(async () => {
      try {
        setError(null)
        // TODO: Implement disconnect endpoint
        setError('Disconnect not yet implemented')
      } catch (err) {
        console.error(`Error disconnecting ${name}:`, err)
        setError(err instanceof Error ? err.message : 'Failed to disconnect')
      }
    })
  }

  const getConnectorDisplayName = (name: ConnectorStatus['name']): string => {
    switch (name) {
      case 'github':
        return 'GitHub'
      case 'linear':
        return 'Linear'
      case 'vercel':
        return 'Vercel'
      default:
        return name
    }
  }

  const getConnectorDescription = (name: ConnectorStatus['name']): string => {
    switch (name) {
      case 'github':
        return 'Connect your GitHub account to enable repository access and pull request creation'
      case 'linear':
        return 'Connect your Linear account to sync issues and track task progress'
      case 'vercel':
        return 'Connect your Vercel account to enable deployment tools in chat'
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="text-gray-500 dark:text-gray-400">Loading connectors...</div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {connectors.map((connector) => (
        <div
          key={connector.name}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {getConnectorDisplayName(connector.name)}
                </h3>
                {connector.connected ? (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {getConnectorDescription(connector.name)}
              </p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              {connector.connected ? (
                <>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={connector.enabled}
                      onChange={(e) => handleToggle(connector.name, e.target.checked)}
                      disabled={isPending}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-gray-700 dark:peer-checked:bg-blue-500"></div>
                    <div className="peer-checked:translate-x-full peer absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform dark:bg-gray-300"></div>
                  </label>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {connector.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(connector.name)}
                    disabled={isPending}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleConnect(connector.name)}
                  disabled={isPending}
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
