'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import type { AgentModeId } from '@/lib/api/types'
import { useComposer } from './composer-context'

export function ModeToggle() {
  const { mode, onModeChange, availableModes, isStreaming } = useComposer()

  const currentMode = availableModes.find((m) => m.id === mode)

  if (availableModes.length <= 1) {
    return (
      <span className="text-sm text-muted-foreground">
        {currentMode?.label ?? mode}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            disabled={isStreaming}
            className="group h-auto gap-1 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent disabled:opacity-60 disabled:pointer-events-none"
          >
            <span className="text-sm">{currentMode?.label ?? mode}</span>
            <svg
              className="h-3 w-3 shrink-0 opacity-40 transition-opacity duration-150 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
            </svg>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[140px]">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => onModeChange(value as AgentModeId)}
        >
          {availableModes.map((m) => (
            <DropdownMenuRadioItem key={m.id} value={m.id}>
              {m.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
