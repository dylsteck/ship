'use client'

import { cn } from '@ship/ui'
import type { GitHubRepo, ModelInfo } from '@/lib/api/types'
import { DashboardStats } from '@/components/dashboard-stats'
import { ComposerProvider, type ComposerContextValue } from './composer-context'
import { ComposerTextarea } from './composer-textarea'
import { ComposerFooter } from './composer-footer'
import { RepoSelector } from './repo-selector'
import { SubmitButton } from './submit-button'

interface DashboardComposerProps {
  activeSessionId: string | null
  prompt: string
  onPromptChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  selectedRepo: GitHubRepo | null
  onRepoSelect: (repo: GitHubRepo) => void
  repos: GitHubRepo[]
  reposLoading: boolean
  selectedModel: ModelInfo | null
  onModelSelect: (model: ModelInfo) => void
  modelsLoading: boolean
  groupedByProvider: Record<string, ModelInfo[]>
  mode: 'build' | 'plan'
  onModeChange: (mode: 'build' | 'plan') => void
  onSubmit: () => void
  onStop: () => void
  isCreating: boolean
  isStreaming: boolean
  messageQueueLength: number
  stats: {
    sessionsPastWeek: number
    messagesPastWeek: number
    activeRepos: number
    sessionsChartData: number[]
    messagesChartData: number[]
    activeReposChartData: number[]
  }
  canSubmit: boolean
  /** When true, use normal flow instead of absolute centering (for mobile with session list below) */
  compactLayout?: boolean
}

export function DashboardComposer(props: DashboardComposerProps) {
  const { activeSessionId, stats, compactLayout } = props

  const contextValue: ComposerContextValue = {
    activeSessionId: props.activeSessionId,
    prompt: props.prompt,
    onPromptChange: props.onPromptChange,
    onKeyDown: props.onKeyDown,
    selectedRepo: props.selectedRepo,
    onRepoSelect: props.onRepoSelect,
    repos: props.repos,
    reposLoading: props.reposLoading,
    selectedModel: props.selectedModel,
    onModelSelect: props.onModelSelect,
    modelsLoading: props.modelsLoading,
    groupedByProvider: props.groupedByProvider,
    mode: props.mode,
    onModeChange: props.onModeChange,
    onSubmit: props.onSubmit,
    onStop: props.onStop,
    isCreating: props.isCreating,
    isStreaming: props.isStreaming,
    messageQueueLength: props.messageQueueLength,
    canSubmit: props.canSubmit,
  }

  return (
    <ComposerProvider value={contextValue}>
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
                    <RepoSelector />
                  </div>
                  <SubmitButton />
                </div>
              )}
            </div>

            <ComposerFooter />
          </div>

          {!activeSessionId && (
            <div className="mt-6 hidden sm:block">
              <DashboardStats stats={stats} />
            </div>
          )}
        </div>
      </div>
    </ComposerProvider>
  )
}
