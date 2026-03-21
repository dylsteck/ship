'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import type { AgentModeId } from '@/lib/api/types'
import { useComposer } from './composer-context'

export function ModeToggle() {
  const { mode, onModeChange, availableModes, isStreaming } = useComposer()

  const currentMode = availableModes.find((m) => m.id === mode)
  const defaultMode = availableModes[0]
  const isNonDefault = defaultMode && mode !== defaultMode.id

  const plusButton = (
    <Button
      variant="ghost"
      size="sm"
      disabled={isStreaming}
      className="group flex items-center justify-center size-6 p-0 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 disabled:pointer-events-none"
    >
      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
      </svg>
    </Button>
  )

  if (availableModes.length <= 1) {
    return (
      <button
        type="button"
        disabled={isStreaming}
        className="flex items-center justify-center size-6 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60 disabled:pointer-events-none"
      >
        <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
        </svg>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger render={plusButton} />
        <DropdownMenuContent align="start" className="w-[140px]">
          {availableModes
            .filter((m) => m.id !== defaultMode?.id)
            .map((m) => (
              <DropdownMenuItem key={m.id} onClick={() => onModeChange(m.id)}>
                {m.label}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {isNonDefault && currentMode && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 h-6 text-xs font-medium text-rose-400">
          {currentMode.label}
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => onModeChange(defaultMode.id)}
            className="ml-0.5 rounded-full hover:bg-rose-500/20 transition-colors disabled:opacity-60"
          >
            <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      )}
    </div>
  )
}
