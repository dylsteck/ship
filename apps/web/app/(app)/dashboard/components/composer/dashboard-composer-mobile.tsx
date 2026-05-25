'use client'

import { cn } from '@ship/ui'
import { ClientOnly } from '@/components/client-only'
import { ComposerTextarea } from './composer-textarea'
import { SubmitButton } from './submit-button'
import { ModeToggle } from './mode-toggle'

/** Single-row follow-up composer for mobile session chat (matches session EnhancedPromptInput). */
export function DashboardComposerMobileFollowUp() {
  return (
    <div className="shrink-0 border-t border-border/30 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl border border-border/50 bg-card overflow-hidden',
          'focus-within:border-border/70 focus-within:ring-1 focus-within:ring-foreground/5',
        )}
      >
        <div className="flex shrink-0 items-center pl-2">
          <ClientOnly>
            <ModeToggle />
          </ClientOnly>
        </div>
        <div className="min-w-0 flex-1 py-2">
          <ComposerTextarea />
        </div>
        <div className="flex shrink-0 items-center pr-2">
          <SubmitButton size="small" />
        </div>
      </div>
    </div>
  )
}
