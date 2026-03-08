'use client'

import { cn } from '@ship/ui'
import { ClientOnly } from '@/components/client-only'
import { useComposer } from './composer-context'
import { AgentSelector } from './agent-selector'
import { ModelSelector } from './model-selector'
import { ModeToggle } from './mode-toggle'
import { SubmitButton } from './submit-button'

function ModelSelectorWithSeparator() {
  const { groupedByProvider } = useComposer()
  const totalModels = Object.values(groupedByProvider).reduce((sum, models) => sum + models.length, 0)
  if (totalModels <= 1) return null
  return (
    <>
      <span className="text-[10px] text-muted-foreground/30">/</span>
      <ModelSelector />
    </>
  )
}

export function ComposerFooter() {
  const { activeSessionId, messageQueueLength } = useComposer()

  return (
    <div
      className={cn(
        'px-3 py-1.5 flex items-center justify-between border-t transition-colors',
        activeSessionId
          ? 'border-border/30 bg-muted/20'
          : 'border-zinc-700/50 bg-zinc-800/80 text-zinc-300 [&_button]:text-zinc-300 [&_button:hover]:bg-zinc-700 [&_button:hover]:text-zinc-100',
      )}
    >
      <div className="flex items-center gap-2">
        <ClientOnly>
          <AgentSelector />
          <ModelSelectorWithSeparator />
        </ClientOnly>
        {activeSessionId && messageQueueLength > 0 && (
          <span className="text-[10px] text-muted-foreground/40">{messageQueueLength} queued</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle />
        {activeSessionId && <SubmitButton size="small" />}
      </div>
    </div>
  )
}
