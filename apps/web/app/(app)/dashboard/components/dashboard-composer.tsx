'use client'

import { useRef } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  AttachmentIcon,
  ArrowUp02Icon,
  GithubIcon,
  PlusSignIcon,
  StopIcon,
} from '@hugeicons/core-free-icons'
import type { GitHubRepo, ModelInfo } from '@/lib/api'
import { DashboardStats } from '@/components/dashboard-stats'

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
  }
  canSubmit: boolean
}

export function DashboardComposer({
  activeSessionId,
  prompt,
  onPromptChange,
  onKeyDown,
  selectedRepo,
  onRepoSelect,
  repos,
  reposLoading,
  selectedModel,
  onModelSelect,
  modelsLoading,
  groupedByProvider,
  mode,
  onModeChange,
  onSubmit,
  onStop,
  isCreating,
  isStreaming,
  messageQueueLength,
  stats,
  canSubmit,
}: DashboardComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div
      className={cn(
        'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
        activeSessionId
          ? 'mt-auto pb-4 px-6' // Bottom position
          : 'absolute inset-0 flex items-center justify-center px-6', // Center position
      )}
    >
      <div
        className={cn(
          'w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          activeSessionId ? 'max-w-3xl mx-auto' : 'max-w-[540px]',
        )}
      >
        <div className="rounded-3xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden transition-shadow focus-within:shadow-xl focus-within:ring-2 focus-within:ring-foreground/10">
          <div className="p-4 pb-3">
            <textarea
              ref={textareaRef}
              placeholder={activeSessionId ? 'Send a message...' : 'Ask or build anything'}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={activeSessionId ? 2 : 3}
              className={cn(
                'w-full resize-none bg-transparent text-[15px] placeholder:text-muted-foreground/60 focus:outline-none transition-all duration-300',
                activeSessionId ? 'min-h-[56px]' : 'min-h-[88px]',
              )}
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {!activeSessionId && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" className="rounded-full">
                            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-[220px]">
                        <DropdownMenuItem>
                          <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
                          Add files
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" className="h-8 px-3 rounded-full gap-1.5">
                            <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
                            <span className="max-w-[150px] truncate text-sm">
                              {selectedRepo ? selectedRepo.fullName : 'Select repo'}
                            </span>
                            <HugeiconsIcon
                              icon={ArrowDown01Icon}
                              strokeWidth={2}
                              className="text-muted-foreground size-3.5"
                            />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-[280px] max-h-[300px] overflow-y-auto">
                        {reposLoading ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">Loading repos...</div>
                        ) : repos.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">No repos found</div>
                        ) : (
                          <DropdownMenuGroup>
                            {repos.slice(0, 20).map((repo) => (
                              <DropdownMenuItem key={repo.id} onClick={() => onRepoSelect(repo)}>
                                <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
                                <span className="truncate flex-1">{repo.fullName}</span>
                                {repo.private && (
                                  <span className="text-[10px] text-muted-foreground">private</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                {activeSessionId && messageQueueLength > 0 && (
                  <span className="text-[11px] text-muted-foreground ml-2">{messageQueueLength} queued</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {activeSessionId && isStreaming ? (
                  <Button variant="destructive" size="sm" className="rounded-full px-3 gap-1.5" onClick={onStop}>
                    <HugeiconsIcon icon={StopIcon} strokeWidth={2} className="size-3.5" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    size="icon-sm"
                    className={cn(
                      'rounded-full transition-all',
                      canSubmit
                        ? 'bg-foreground text-background hover:bg-foreground/90'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isCreating ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {!activeSessionId && (
            <div className="px-3 py-1.5 flex items-center justify-between border-t border-border/40 bg-muted/30">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
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

              <div className="flex items-center gap-2 text-[10px]">
                <button
                  onClick={() => onModeChange('build')}
                  className={cn(
                    'transition-colors cursor-pointer',
                    mode === 'build'
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  build
                </button>
                <button
                  onClick={() => onModeChange('plan')}
                  className={cn(
                    'transition-colors cursor-pointer',
                    mode === 'plan'
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  plan
                </button>
              </div>
            </div>
          )}
        </div>

        {!activeSessionId && (
          <div className="mt-6 space-y-6">
            <DashboardStats stats={stats} />
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>1 human prompting</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
