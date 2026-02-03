'use client'

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
import { ArrowDown01Icon, AttachmentIcon, ArrowUp02Icon, GithubIcon, PlusSignIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import type { GitHubRepo, ModelInfo } from '@/lib/api'

type ChatComposerProps = {
  prompt: string
  onPromptChange: (value: string) => void
  selectedRepo: GitHubRepo | null
  onRepoSelect: (repo: GitHubRepo) => void
  repos: GitHubRepo[]
  reposLoading: boolean
  selectedModel: ModelInfo | null
  onModelSelect: (model: ModelInfo) => void
  modelsLoading: boolean
  groupedByProvider: Record<string, ModelInfo[]>
  mode: 'build' | 'agent'
  onModeChange: (mode: 'build' | 'agent') => void
  onSubmit: () => void
  isCreating: boolean
}

export function ChatComposer({
  prompt,
  onPromptChange,
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
  isCreating,
}: ChatComposerProps) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-foreground/10">
      {/* Main input area */}
      <div className="p-4 pb-3">
        <textarea
          placeholder="Ask or build anything"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={3}
          className="w-full min-h-[88px] resize-none bg-transparent text-sm placeholder:text-muted-foreground/80 focus:outline-none"
        />

        {/* Bottom controls row */}
        <div className="mt-3 flex items-center justify-between">
          {/* Left side: Add button and repo selector */}
          <div className="flex items-center gap-1">
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
                    <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="text-muted-foreground size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-[280px] max-h-[300px] overflow-y-auto">
                {reposLoading ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Loading repos...
                  </div>
                ) : repos.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No repos found
                  </div>
                ) : (
                  <DropdownMenuGroup>
                    {repos.slice(0, 20).map((repo) => (
                      <DropdownMenuItem
                        key={repo.id}
                        onClick={() => onRepoSelect(repo)}
                      >
                        <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
                        <span className="truncate flex-1">{repo.fullName}</span>
                        {repo.private && (
                          <span className="text-[10px] text-muted-foreground">private</span>
                        )}
                        {selectedRepo?.id === repo.id && (
                          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="text-foreground" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side: Attach and Send */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" className="rounded-full">
              <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
            </Button>
            <Button
              onClick={onSubmit}
              disabled={!selectedRepo || !prompt.trim() || isCreating}
              size="icon-sm"
              className={cn(
                'rounded-full',
                selectedRepo && prompt.trim() && !isCreating
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
          </div>
        </div>
      </div>

      {/* Attached sub bar for model + mode */}
      <div className="px-3 py-1 flex items-center justify-between border-t border-border/60 bg-muted/40">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                {modelsLoading ? 'Loading...' : (selectedModel?.name || 'Select model')}
                <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="text-muted-foreground size-3.5" />
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
                <DropdownMenuRadioGroup value={selectedModel?.id || ''} onValueChange={(value) => {
                  const model = providerModels.find(m => m.id === value)
                  if (model) onModelSelect(model)
                }}>
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
              mode === 'build' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            build
          </button>
          <button
            onClick={() => onModeChange('agent')}
            className={cn(
              'transition-colors cursor-pointer',
              mode === 'agent' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            agent
          </button>
        </div>
      </div>
    </div>
  )
}
