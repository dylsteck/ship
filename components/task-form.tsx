'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, ArrowUp, Settings, Cable, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface TaskFormProps {
  onSubmit: (data: {
    prompt: string
    repoUrl: string
    selectedAgent: string
    selectedModel: string
    installDependencies: boolean
    maxDuration: number
    keepAlive: boolean
    enableBrowser: boolean
  }) => void
  isSubmitting: boolean
  selectedOwner: string
  selectedRepo: string
  initialInstallDependencies?: boolean
  initialMaxDuration?: number
  initialKeepAlive?: boolean
  initialEnableBrowser?: boolean
  maxSandboxDuration?: number
}

const CODING_AGENTS = [
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'copilot', label: 'Copilot' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'opencode', label: 'OpenCode' },
] as const

const AGENT_MODELS = {
  claude: [
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
    { value: 'claude-opus-4-5', label: 'Opus 4.5' },
    { value: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  ],
  codex: [
    { value: 'openai/gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-codex', label: 'GPT-5-Codex' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 mini' },
  ],
  copilot: [
    { value: 'claude-sonnet-4.5', label: 'Sonnet 4.5' },
    { value: 'gpt-5', label: 'GPT-5' },
  ],
  cursor: [
    { value: 'auto', label: 'Auto' },
    { value: 'sonnet-4.5', label: 'Sonnet 4.5' },
    { value: 'gpt-5', label: 'GPT-5' },
  ],
  gemini: [
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
  opencode: [
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
    { value: 'claude-opus-4-5', label: 'Opus 4.5' },
  ],
} as const

const DEFAULT_MODELS = {
  claude: 'claude-sonnet-4-5',
  codex: 'openai/gpt-5',
  copilot: 'claude-sonnet-4.5',
  cursor: 'auto',
  gemini: 'gemini-3-pro-preview',
  opencode: 'gpt-5',
} as const

export function TaskForm({
  onSubmit,
  isSubmitting,
  selectedOwner,
  selectedRepo,
  initialInstallDependencies = false,
  initialMaxDuration = 300,
  initialKeepAlive = false,
  initialEnableBrowser = false,
  maxSandboxDuration = 300,
}: TaskFormProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<string>('claude')
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODELS.claude)
  const [installDependencies, setInstallDependencies] = useState(initialInstallDependencies)
  const [maxDuration, setMaxDuration] = useState(initialMaxDuration)
  const [keepAlive, setKeepAlive] = useState(initialKeepAlive)
  const [enableBrowser, setEnableBrowser] = useState(initialEnableBrowser)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  useEffect(() => {
    const defaultModel = DEFAULT_MODELS[selectedAgent as keyof typeof DEFAULT_MODELS]
    if (defaultModel) {
      setSelectedModel(defaultModel)
    }
  }, [selectedAgent])

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
      if (!isMobile && !e.shiftKey) {
        e.preventDefault()
        if (prompt.trim()) {
          const form = e.currentTarget.closest('form')
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
          }
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) {
      return
    }

    const repoUrl = selectedOwner && selectedRepo ? `https://github.com/${selectedOwner}/${selectedRepo}` : ''

    onSubmit({
      prompt: prompt.trim(),
      repoUrl,
      selectedAgent,
      selectedModel,
      installDependencies,
      maxDuration,
      keepAlive,
      enableBrowser,
    })
  }

  const getAgentInitial = (agent: string) => {
    return agent.charAt(0).toUpperCase()
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Ship</h1>
        <p className="text-lg text-muted-foreground mb-2">
          AI coding agent powered by Vercel Sandbox
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="relative border rounded-2xl shadow-sm overflow-hidden bg-muted/30 cursor-text">
          <div className="relative bg-transparent">
            <Textarea
              ref={textareaRef}
              id="prompt"
              placeholder="Describe what you want the AI agent to do..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              disabled={isSubmitting}
              required
              rows={4}
              className="w-full border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-4 text-base !bg-transparent shadow-none!"
            />
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Agent Selection */}
                <Select
                  value={selectedAgent}
                  onValueChange={setSelectedAgent}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-auto sm:min-w-[120px] border-0 bg-transparent shadow-none focus:ring-0 h-8 shrink-0">
                    <SelectValue placeholder="Agent">
                      {selectedAgent && (
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                            {getAgentInitial(selectedAgent)}
                          </span>
                          <span className="hidden sm:inline">
                            {CODING_AGENTS.find((a) => a.value === selectedAgent)?.label}
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CODING_AGENTS.map((agent) => (
                      <SelectItem key={agent.value} value={agent.value}>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                            {getAgentInitial(agent.value)}
                          </span>
                          <span>{agent.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Model Selection */}
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="flex-1 sm:flex-none sm:w-auto sm:min-w-[140px] border-0 bg-transparent shadow-none focus:ring-0 h-8 min-w-0">
                    <SelectValue placeholder="Model" className="truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_MODELS[selectedAgent as keyof typeof AGENT_MODELS]?.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-2 shrink-0">
                <TooltipProvider delayDuration={1500} skipDelayDuration={1500}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full h-8 w-8 p-0 relative"
                        onClick={() => setEnableBrowser(!enableBrowser)}
                      >
                        <Globe className="h-4 w-4" />
                        {enableBrowser && (
                          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Agent Browser</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full h-8 w-8 p-0 relative"
                      >
                        <Cable className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>MCP Servers</p>
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full h-8 w-8 p-0 relative"
                          >
                            <Settings className="h-4 w-4" />
                            {(() => {
                              const customOptionsCount = [
                                !installDependencies,
                                maxDuration !== maxSandboxDuration,
                                keepAlive,
                              ].filter(Boolean).length
                              return customOptionsCount > 0 ? (
                                <Badge
                                  variant="secondary"
                                  className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] rounded-full sm:hidden"
                                >
                                  {customOptionsCount}
                                </Badge>
                              ) : null
                            })()}
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Task Options</p>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-72" align="end">
                      <DropdownMenuLabel>Task Options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <div className="p-2 space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="install-deps"
                            checked={installDependencies}
                            onCheckedChange={(checked) => setInstallDependencies(checked === true)}
                          />
                          <Label
                            htmlFor="install-deps"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Install Dependencies?
                          </Label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max-duration" className="text-sm font-medium">
                            Maximum Duration
                          </Label>
                          <Select
                            value={maxDuration.toString()}
                            onValueChange={(value) => setMaxDuration(parseInt(value))}
                          >
                            <SelectTrigger id="max-duration" className="w-full h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 minutes</SelectItem>
                              <SelectItem value="10">10 minutes</SelectItem>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="120">2 hours</SelectItem>
                              <SelectItem value="300">5 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="keep-alive"
                              checked={keepAlive}
                              onCheckedChange={(checked) => setKeepAlive(checked === true)}
                            />
                            <Label
                              htmlFor="keep-alive"
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              Keep Alive ({maxSandboxDuration}m max)
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Keep sandbox running after completion.
                          </p>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipProvider>

                <Button
                  type="submit"
                  disabled={isSubmitting || !prompt.trim()}
                  size="sm"
                  className="rounded-full h-8 w-8 p-0"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
