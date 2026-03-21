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

function shortenModelName(name: string): string {
  // "Claude Opus 4.6" → "Opus 4.6", "Claude Sonnet 4.6" → "Sonnet 4.6"
  return name.replace(/^Claude\s+/i, '')
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

  // Build trigger label: show short model name (e.g. "Opus 4.6")
  let triggerLabel = 'Select agent'
  if (loading) {
    triggerLabel = 'Loading...'
  } else if (selectedAgent) {
    const agentModels = selectedAgent.models ?? []
    if (selectedModel) {
      triggerLabel = shortenModelName(selectedModel.name)
    } else if (agentModels.length === 1) {
      triggerLabel = shortenModelName(agentModels[0].name)
    } else {
      triggerLabel = selectedAgent.name
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={isStreaming}
            className="group h-6 gap-0.5 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent! hover:shadow-none! disabled:opacity-60 disabled:pointer-events-none max-w-full overflow-hidden"
          >
            <span className="truncate text-xs">{triggerLabel}</span>
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
      <DropdownMenuContent align="start" className="w-[180px]">
        {agents.map((agent, agentIdx) => {
          const agentModels = agent.models ?? []
          const isAgentSelected = selectedAgent?.id === agent.id

          return (
            <div key={agent.id}>
              {agentModels.length > 1 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    className={cn(
                      'cursor-pointer [&>svg.ml-auto]:hidden',
                      isAgentSelected && 'bg-accent',
                    )}
                  >
                    <span className="text-xs">{agent.name}</span>
                    {isAgentSelected && (
                      <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} className="shrink-0 text-foreground ml-auto mr-1" />
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-[200px]">
                    {agentModels.map((model) => {
                      const isModelSelected = isAgentSelected && selectedModel?.id === model.id
                      return (
                        <DropdownMenuItem
                          key={model.id}
                          className={cn(
                            'flex items-center justify-between cursor-pointer',
                            isModelSelected && 'bg-accent',
                          )}
                          onClick={() => {
                            if (!isAgentSelected) onAgentSelect(agent)
                            onModelSelect(model)
                          }}
                        >
                          <span className="truncate text-xs">{model.name}</span>
                          {isModelSelected && (
                            <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} className="shrink-0 text-foreground" />
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  className={cn(
                    'flex items-center justify-between cursor-pointer',
                    isAgentSelected && 'bg-accent',
                  )}
                  onClick={() => {
                    onAgentSelect(agent)
                    if (agentModels.length === 1) onModelSelect(agentModels[0])
                  }}
                >
                  <span className="truncate text-xs">{agent.name}</span>
                  {isAgentSelected && (
                    <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} className="shrink-0 text-foreground" />
                  )}
                </DropdownMenuItem>
              )}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
