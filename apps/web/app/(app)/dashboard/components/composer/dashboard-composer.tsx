'use client'

import { cn } from '@ship/ui'
import { ClientOnly } from '@/components/client-only'
import { ComposerProvider, type ComposerContextValue } from './composer-context'
import { ComposerTextarea } from './composer-textarea'
import { ComposerRepoSelector } from './repo-selector'
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
            ? 'mt-auto pb-3 sm:pb-4 px-4 sm:px-8 bg-background/80 backdrop-blur-sm'
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
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 min-h-[28px] px-0.5 pb-1.5">
              <ClientOnly>
                <ComposerRepoSelector />
              </ClientOnly>
            </div>
          )}

          {activeSessionId ? (
            /* Session follow-up: slim single-line pill */
            <div className="flex flex-col rounded-[20px] border border-border/40 bg-card/95 backdrop-blur-sm shadow-md focus-within:border-border/60 focus-within:shadow-lg px-3 min-h-[40px] py-[10px]">
              <div className="flex-1 min-w-0">
                <ComposerTextarea />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="shrink-0">
                  <ClientOnly>
                    <ModeToggle />
                  </ClientOnly>
                </div>
                <ClientOnly>
                  <AgentModelSelector />
                </ClientOnly>
                <div className="flex-1" />
                <SubmitButton size="small" />
              </div>
            </div>
          ) : (
            /* Home: full multi-line composer card */
            <div className="rounded-3xl border overflow-hidden transition-all bg-card border-border/50 focus-within:ring-2 focus-within:ring-foreground/10">
              {/* Textarea */}
              <div className="px-3 pt-3">
                <ComposerTextarea />
              </div>

              {/* Bottom bar inside the card: + mode button, model selector, spacer, submit */}
              <div className="flex items-center gap-2.5 px-3 pb-1 h-[40px]">
                <div className="flex items-center gap-2">
                  <ClientOnly>
                    <ModeToggle />
                  </ClientOnly>
                  <div className="shrink min-w-0 overflow-hidden">
                    <ClientOnly>
                      <AgentModelSelector />
                    </ClientOnly>
                  </div>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2 shrink-0">
                  <SubmitButton />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ComposerProvider>
  )
}
