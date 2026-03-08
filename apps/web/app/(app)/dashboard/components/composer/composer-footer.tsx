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
        'px-3 py-1.5 flex items-center justify-between border-t border-border/30',
        activeSessionId ? 'bg-muted/20' : 'bg-muted/30',
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
