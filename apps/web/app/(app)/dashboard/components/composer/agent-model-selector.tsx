'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@ship/ui'
import { useComposer } from './composer-context'
import { AgentModelMenuItems, selectedModelForAgent } from './agent-model-menu-items'

function shortenModelName(name: string): string {
  return name.replace(/^Claude\s+/i, '')
}

function AgentModelReadOnly({ harness: triggerHarness, model: triggerModel, loading }: {
  harness: string
  model?: string
  loading: boolean
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground max-w-full overflow-hidden">
      <span className="truncate font-medium">{triggerHarness}</span>
      {triggerModel && !loading && (
        <span className="truncate text-muted-foreground/70">/ {shortenModelName(triggerModel)}</span>
      )}
    </span>
  )
}

export function AgentModelSelector() {
  const {
    activeSessionId,
    selectedAgent,
    selectedModel,
    onAgentSelect,
    onModelSelect,
    agents,
    agentDefaultModels,
    agentsLoading,
    modelsLoading,
    isStreaming,
  } = useComposer()

  const loading = agentsLoading || modelsLoading
  const triggerHarness = loading ? 'Loading...' : selectedAgent?.name || 'Select harness'
  const triggerModel =
    selectedModelForAgent(selectedAgent, selectedModel)?.name ??
    (selectedAgent ? agentDefaultModels[selectedAgent.id]?.name : undefined) ??
    selectedModel?.name

  if (activeSessionId) {
    return <AgentModelReadOnly harness={triggerHarness} model={triggerModel} loading={loading} />
  }

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
      <DropdownMenuContent
        align="start"
        className="w-[220px] rounded-[14px] border border-border/60 bg-card/95 p-1.5 shadow-2xl shadow-black/35 ring-0 backdrop-blur-xl"
      >
        <AgentModelMenuItems
          agents={agents}
          selectedAgent={selectedAgent}
          selectedModel={selectedModel}
          agentDefaultModels={agentDefaultModels}
          onAgentSelect={onAgentSelect}
          onModelSelect={onModelSelect}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
