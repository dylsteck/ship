'use client'

import { cn } from '@ship/ui'
import { ClientOnly } from '@/components/client-only'
import { ComposerProvider, type ComposerContextValue } from './composer-context'
import { ComposerTextarea } from './composer-textarea'
import { ComposerFooter } from './composer-footer'
import { ComposerRepoSelector } from './repo-selector'
import { SubmitButton } from './submit-button'

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
            ? 'mt-auto pb-3 px-3 sm:pb-4 sm:px-6'
            : compactLayout
              ? 'flex flex-col px-3 pt-4 pb-2'
              : 'absolute inset-0 flex items-start sm:items-center justify-center px-3 sm:px-6 pt-[10vh] sm:pt-0',
        )}
      >
        <div
          className={cn(
            'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
            activeSessionId ? 'max-w-3xl mx-auto' : compactLayout ? 'w-full' : 'max-w-[540px]',
          )}
        >
          <div
            className={cn(
              'rounded-2xl border bg-card/95 backdrop-blur-sm overflow-hidden transition-all',
              activeSessionId
                ? 'border-border/40 shadow-md focus-within:border-border/60 focus-within:shadow-lg'
                : 'rounded-3xl border-border/60 shadow-lg focus-within:shadow-xl focus-within:ring-2 focus-within:ring-foreground/10',
            )}
          >
            {/* Textarea area */}
            <div className={cn('px-3 pt-4', activeSessionId ? 'pb-2' : 'pb-3')}>
              <ComposerTextarea />

              {!activeSessionId && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <ClientOnly>
                      <ComposerRepoSelector />
                    </ClientOnly>
                  </div>
                  <SubmitButton />
                </div>
              )}
            </div>

            <ComposerFooter />
          </div>
        </div>
      </div>
    </ComposerProvider>
  )
}
