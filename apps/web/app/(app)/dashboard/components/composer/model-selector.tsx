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
import { cn } from '@ship/ui/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { useComposer } from './composer-context'

export function ModelSelector({
  triggerClassName,
}: {
  /** Optional trigger class (e.g. match repo selector style above input) */
  triggerClassName?: string
} = {}) {
  const { selectedModel, onModelSelect, modelsLoading, groupedByProvider, isStreaming } = useComposer()

  // Count total models across all providers
  const totalModels = Object.values(groupedByProvider).reduce((sum, models) => sum + models.length, 0)

  // Single-model agent: hide entirely (agent name is sufficient) unless custom trigger style requested
  if (totalModels <= 1 && !triggerClassName) {
    return null
  }

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
            {modelsLoading ? 'Loading...' : selectedModel?.name || 'Select model'}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="text-muted-foreground size-3"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[240px]">
        {Object.entries(groupedByProvider).map(([provider, providerModels], idx) => (
          <DropdownMenuGroup key={provider}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground capitalize font-normal">
              {provider}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={selectedModel?.id || ''}
              onValueChange={(value) => {
                const model = providerModels.find((m) => m.id === value)
                if (model) onModelSelect(model)
              }}
            >
              {providerModels.map((model) => (
                <DropdownMenuRadioItem key={model.id} value={model.id}>
                  {model.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
