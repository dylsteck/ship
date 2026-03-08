'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { useComposer } from './composer-context'
import { cn } from '@ship/ui/utils'

export function AgentSelector({
  triggerClassName,
}: {
  /** Optional trigger class (e.g. match repo selector style above input) */
  triggerClassName?: string
} = {}) {
  const { selectedAgent, onAgentSelect, agents, agentsLoading, isStreaming } = useComposer()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            disabled={isStreaming}
            className={cn(
              'gap-1 disabled:opacity-60 disabled:pointer-events-none',
              triggerClassName
                ? 'h-8 px-2 sm:px-3 rounded-full text-sm max-w-[140px] truncate text-left'
                : 'h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground',
              triggerClassName,
            )}
          >
            {agentsLoading ? 'Loading...' : selectedAgent?.name || 'Select agent'}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="text-muted-foreground size-3 shrink-0"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[180px]">
        <DropdownMenuRadioGroup
          value={selectedAgent?.id || ''}
          onValueChange={(value) => {
            const agent = agents.find((a) => a.id === value)
            if (agent) onAgentSelect(agent)
          }}
        >
          {agents.map((agent) => (
            <DropdownMenuRadioItem key={agent.id} value={agent.id}>
              {agent.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
