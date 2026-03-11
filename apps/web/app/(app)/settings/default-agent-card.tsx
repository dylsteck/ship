'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@ship/ui'
import { useSetDefaultAgent } from '@/lib/api/hooks/use-agents'
import { useDefaultAgent } from '@/lib/api/hooks/use-agents'
import type { AgentInfo } from '@/lib/api/types'

interface DefaultAgentCardProps {
  userId: string
  agents: AgentInfo[]
  defaultAgentId: string | null
  onAgentChange: (agentId: string) => void
}

export function DefaultAgentCard({ userId, agents, defaultAgentId, onAgentChange }: DefaultAgentCardProps) {
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const { setDefaultAgent, isSetting } = useSetDefaultAgent()
  const { mutate } = useDefaultAgent(userId)

  useEffect(() => {
    if (defaultAgentId && !selected) {
      setSelected(defaultAgentId)
    }
  }, [defaultAgentId, selected])

  const hasChanges = selected !== (defaultAgentId || '')

  const handleSave = async () => {
    try {
      setSaveSuccess(false)
      setError(null)
      await setDefaultAgent({ userId, agentId: selected })
      mutate()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Default Agent</CardTitle>
        <CardDescription className="text-xs">
          Choose which agent is used by default for new sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Agent</label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              onAgentChange(e.target.value)
            }}
            disabled={isSetting}
            className="w-full h-9 px-3 text-[13px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        {saveSuccess && (
          <div className="rounded-md bg-emerald-500/10 px-3 py-2">
            <p className="text-xs text-emerald-600">Saved!</p>
          </div>
        )}
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSetting}>
            {isSetting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
