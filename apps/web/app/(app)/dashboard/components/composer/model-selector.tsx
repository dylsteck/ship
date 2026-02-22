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
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { useComposer } from './composer-context'

export function ModelSelector() {
  const { selectedModel, onModelSelect, modelsLoading, groupedByProvider, isStreaming } = useComposer()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            disabled={isStreaming}
            className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-60 disabled:pointer-events-none"
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
