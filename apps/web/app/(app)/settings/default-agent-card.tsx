'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
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
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Default Agent</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which agent is used by default for new sessions
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={selected}
            onValueChange={(val) => {
              if (val) {
                setSelected(val)
                onAgentChange(val)
              }
            }}
            disabled={isSetting}
          >
            <SelectTrigger className="min-w-[140px]">
              <SelectValue placeholder={agents.find(a => a.id === selected)?.name ?? 'Select agent'} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasChanges && (
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSetting} className="h-7 text-xs">
              {isSetting ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 px-3 py-1.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {saveSuccess && (
        <div className="mt-2 rounded-md bg-emerald-500/10 px-3 py-1.5">
          <p className="text-xs text-emerald-600">Saved!</p>
        </div>
      )}
    </div>
  )
}
