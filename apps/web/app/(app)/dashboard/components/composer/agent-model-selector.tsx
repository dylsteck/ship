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
import { useComposer } from './composer-context'
import type { AgentInfo, ModelInfo } from '@/lib/api/types'

function shortenModelName(name: string): string {
  // "Claude Opus 4.6" → "Opus 4.6", "Claude Sonnet 4.6" → "Sonnet 4.6"
  return name.replace(/^Claude\s+/i, '')
}

function modelSubtitle(model: ModelInfo): string {
  const parts: string[] = []
  if (model.isFree && !/free/i.test(model.provider)) parts.push('Free')
  if (model.contextWindow) parts.push(`${Math.round(model.contextWindow / 1000)}K ctx`)
  return parts.join(' - ')
}

function selectedModelForAgent(agent: AgentInfo | null, selectedModel: ModelInfo | null): ModelInfo | undefined {
  return agent?.models?.find((model) => model.id === selectedModel?.id)
}

export function AgentModelSelector() {
  const {
    selectedAgent,
    selectedModel,
    onAgentSelect,
    onModelSelect,
    agents,
    agentsLoading,
    modelsLoading,
    isStreaming,
  } = useComposer()

  const loading = agentsLoading || modelsLoading
  const triggerHarness = loading ? 'Loading...' : selectedAgent?.name || 'Select harness'
  const triggerModel = selectedModelForAgent(selectedAgent, selectedModel)?.name ?? selectedModel?.name

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={isStreaming}
            className="group h-6 gap-1 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent! hover:shadow-none! disabled:opacity-60 disabled:pointer-events-none max-w-full overflow-hidden"
          >
            <span className="truncate text-xs font-medium">{triggerHarness}</span>
            {triggerModel && !loading && (
              <span className="truncate text-xs text-muted-foreground/70">/ {shortenModelName(triggerModel)}</span>
            )}
            <svg
              className="size-2.5 shrink-0 opacity-40 transition-opacity duration-150 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
            </svg>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[220px]">
        {agents.map((agent) => {
          const agentModels = agent.models ?? []
          const isAgentSelected = selectedAgent?.id === agent.id
          const selectedAgentModel = selectedModelForAgent(agent, selectedModel)

          return (
            <div key={agent.id}>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className={cn('cursor-pointer gap-2 [&>svg.ml-auto]:hidden', isAgentSelected && 'bg-accent')}
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
                <DropdownMenuSubContent className="w-[260px] max-h-[360px] overflow-y-auto">
                  {agentModels.map((model) => {
                    const isModelSelected = isAgentSelected && selectedModel?.id === model.id
                    return (
                      <DropdownMenuItem
                        key={model.id}
                        className={cn(
                          'flex items-center justify-between gap-2 cursor-pointer',
                          isModelSelected && 'bg-accent',
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
