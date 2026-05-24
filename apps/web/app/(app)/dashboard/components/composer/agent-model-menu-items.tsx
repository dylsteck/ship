'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'
import type { AgentInfo, ModelInfo } from '@/lib/api/types'

function modelSubtitle(model: ModelInfo): string {
  const parts: string[] = []
  if (model.isFree && !/free/i.test(model.provider)) parts.push('Free')
  if (model.contextWindow) parts.push(`${Math.round(model.contextWindow / 1000)}K ctx`)
  return parts.join(' - ')
}

function selectedModelForAgent(agent: AgentInfo | null, selectedModel: ModelInfo | null): ModelInfo | undefined {
  return agent?.models?.find((model) => model.id === selectedModel?.id)
}

export function AgentModelMenuItems({
  agents,
  selectedAgent,
  selectedModel,
  agentDefaultModels,
  onAgentSelect,
  onModelSelect,
}: {
  agents: AgentInfo[]
  selectedAgent: AgentInfo | null
  selectedModel: ModelInfo | null
  agentDefaultModels: Record<string, ModelInfo | undefined>
  onAgentSelect: (agent: AgentInfo) => void
  onModelSelect: (model: ModelInfo) => void
}) {
  return (
    <>
      {agents.map((agent) => {
        const agentModels = agent.models ?? []
        const isAgentSelected = selectedAgent?.id === agent.id
        const selectedAgentModel = selectedModelForAgent(agent, selectedModel) ?? agentDefaultModels[agent.id]

        return (
          <div key={agent.id}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={cn(
                  'cursor-pointer gap-2 rounded-[8px] px-2.5 py-2 hover:bg-muted/70 focus:bg-muted/70 data-popup-open:bg-muted/70 [&>svg.ml-auto]:hidden',
                  isAgentSelected && 'bg-muted/70',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{agent.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {selectedAgentModel?.name ?? 'Choose model'}
                  </span>
                </span>
                {isAgentSelected && (
                  <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} className="shrink-0 text-foreground" />
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-[260px] max-h-[360px] overflow-y-auto rounded-[14px] border border-border/60 bg-card/95 p-1.5 shadow-2xl shadow-black/35 ring-0 backdrop-blur-xl">
                {agentModels.map((model) => {
                  const isModelSelected = isAgentSelected && selectedAgentModel?.id === model.id
                  return (
                    <DropdownMenuItem
                      key={model.id}
                      className={cn(
                        'flex items-center justify-between gap-2 cursor-pointer rounded-[8px] px-2.5 py-2 hover:bg-muted/70 focus:bg-muted/70',
                        isModelSelected && 'bg-muted/70',
                      )}
                      onClick={() => {
                        if (!isAgentSelected) onAgentSelect(agent)
                        onModelSelect(model)
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs">{model.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{modelSubtitle(model)}</span>
                      </span>
                      {isModelSelected && (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          size={14}
                          strokeWidth={2.5}
                          className="shrink-0 text-foreground"
                        />
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
        )
      })}
    </>
  )
}

export { selectedModelForAgent }
