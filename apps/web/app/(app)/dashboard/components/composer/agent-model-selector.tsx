'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ship/ui'
import { useComposer } from './composer-context'

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

  // Build trigger label: "AgentName ModelName" or just "AgentName" if single model
  let triggerLabel = 'Select agent'
  if (loading) {
    triggerLabel = 'Loading...'
  } else if (selectedAgent) {
    const agentModels = selectedAgent.models ?? []
    if (agentModels.length <= 1 || !selectedModel) {
      triggerLabel = selectedAgent.name
    } else {
      triggerLabel = `${selectedAgent.name} ${selectedModel.name}`
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
      <DropdownMenuContent align="start" className="w-[260px]">
        {agents.map((agent, agentIdx) => {
          const agentModels = agent.models ?? []

          return (
            <DropdownMenuGroup key={agent.id}>
              {agentIdx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs font-medium">
                {agent.name}
              </DropdownMenuLabel>
              {agentModels.length > 0 ? (
                <DropdownMenuRadioGroup
                  value={selectedAgent?.id === agent.id ? selectedModel?.id || '' : ''}
                  onValueChange={(modelId) => {
                    const model = agentModels.find((m) => m.id === modelId)
                    if (model) {
                      if (selectedAgent?.id !== agent.id) {
                        onAgentSelect(agent)
                      }
                      onModelSelect(model)
                    }
                  }}
                >
                  {agentModels.map((model) => (
                    <DropdownMenuRadioItem key={model.id} value={model.id}>
                      {model.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              ) : (
                <DropdownMenuRadioGroup
                  value={selectedAgent?.id || ''}
                  onValueChange={() => onAgentSelect(agent)}
                >
                  <DropdownMenuRadioItem value={agent.id}>
                    {agent.name}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuGroup>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
