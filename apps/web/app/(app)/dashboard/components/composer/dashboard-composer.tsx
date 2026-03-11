'use client'

import { cn } from '@ship/ui'
import { ClientOnly } from '@/components/client-only'
import { ComposerProvider, type ComposerContextValue } from './composer-context'
import { ComposerTextarea } from './composer-textarea'
import { ComposerRepoSelector } from './repo-selector'
import { BranchSelector } from './branch-selector'
import { SubmitButton } from './submit-button'
import { AgentModelSelector } from './agent-model-selector'
import { ModeToggle } from './mode-toggle'

interface DashboardComposerProps {
  /** All shared state consumed by composer sub-components via context */
  context: ComposerContextValue
  /** When true, use normal flow instead of absolute centering (for mobile with session list below). Default false. */
  compactLayout?: boolean
}

export function DashboardComposer({ context, compactLayout = false }: DashboardComposerProps) {
  const { activeSessionId } = context

  return (
    <ComposerProvider value={context}>
      <div
        className={cn(
          'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          activeSessionId
            ? 'mt-auto pb-3 sm:pb-4 px-4 sm:px-8'
            : compactLayout
              ? 'flex flex-col px-3 pt-4 pb-2'
              : 'flex items-start justify-center px-3 sm:px-6 pt-[6vh] sm:pt-[8vh]',
        )}
      >
        <div
          className={cn(
            'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
            activeSessionId ? 'max-w-4xl mx-auto' : compactLayout ? 'w-full' : 'max-w-2xl',
          )}
        >
          {/* Repo + branch above the card (Cursor-style) */}
          {!activeSessionId && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 min-h-[32px] px-1.5 pb-1.5">
              <ClientOnly>
                <ComposerRepoSelector />
              </ClientOnly>
              <ClientOnly>
                <BranchSelector />
              </ClientOnly>
            </div>
          )}
          <div
            className={cn(
              'rounded-2xl border overflow-hidden transition-all',
              activeSessionId
                ? 'bg-card/95 backdrop-blur-sm border-border/40 shadow-md focus-within:border-border/60 focus-within:shadow-lg'
                : 'rounded-3xl bg-card border-border/50 focus-within:ring-2 focus-within:ring-foreground/10',
            )}
          >
            {/* Textarea */}
            <div className="px-3 pt-3">
              <ComposerTextarea />
            </div>

            {/* Bottom bar inside the card: selectors left, actions right */}
            <div className="flex items-center gap-1 px-3 h-[42px]">
              {!activeSessionId && (
                <div className="shrink min-w-0 overflow-hidden">
                  <ClientOnly>
                    <AgentModelSelector />
                  </ClientOnly>
                </div>
              )}
              <div className="ml-2">
                <ClientOnly>
                  <ModeToggle />
                </ClientOnly>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2 shrink-0">
                <SubmitButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ComposerProvider>
  )
}
