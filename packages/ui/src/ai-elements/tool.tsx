'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { ScrollArea } from '../scroll-area'
import { CodeBlock } from './code-block'
import {
  getInputSummary,
  formatOutput,
  parseGrepOutput,
  extractReadContent,
  getLanguageFromPath,
  isFileReadTool,
} from './tool-utils'

interface ToolProps {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: unknown
  duration?: number
  className?: string
  onClick?: () => void
  isSubagent?: boolean
  /** When true, renders as flat list item (no bg/border) for use inside ThinkingBlock */
  compact?: boolean
}

// ============ Tool Icons ============

function ToolIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase()
  const iconClass = 'w-3.5 h-3.5 shrink-0 text-muted-foreground/70'

  if (lowerName.includes('read')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="11" r="4.5" /><circle cx="17.5" cy="11" r="4.5" /><path d="M11 11h2" /><path d="M2 11h0" /><path d="M22 11h0" />
      </svg>
    )
  }

  if (lowerName.includes('glob') || lowerName.includes('search')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
      </svg>
    )
  }

  if (lowerName.includes('grep')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="6" /><path d="m20 20-3.5-3.5" /><path d="M7 10h6" /><path d="M7 8h3" />
      </svg>
    )
  }

  if (lowerName.includes('bash') || lowerName.includes('shell') || lowerName.includes('run') || lowerName.includes('command')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  }

  if (lowerName.includes('write')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    )
  }

  if (lowerName.includes('edit')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    )
  }

  if (lowerName.includes('task') || lowerName.includes('agent')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }

  if (lowerName.includes('web') || lowerName.includes('fetch') || lowerName.includes('url')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  }

  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

// ============ Shared Icons ============

const FILE_ICON = (
  <svg className="w-3 h-3 shrink-0 text-muted-foreground/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

// ============ Specialized Output Renderers ============

function renderToolOutput(
  name: string,
  input: Record<string, unknown> | undefined,
  output: unknown,
): React.ReactNode | null {
  const lower = name.toLowerCase()

  if (lower.includes('grep')) {
    const items = parseGrepOutput(output)
    if (items && items.length > 0) {
      return (
        <ul className="space-y-1 text-foreground/80 font-mono text-[11px]">
          {items.map(({ path, count }, i) => (
            <li key={i} className="flex items-center gap-2 pl-1">
              {FILE_ICON}
              <span className="truncate flex-1 min-w-0">{path}</span>
              {count != null && count > 0 && (
                <span className="text-muted-foreground/60 text-[10px] shrink-0">
                  {count === 1 ? '1 match' : `${count} matches`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )
    }
  }

  if (isFileReadTool(name, input, output) && input) {
    const path = String(input.file_path ?? input.path ?? input.filePath ?? '')
    const start = input.start_line ?? input.startLine ?? input.start
    const end = input.end_line ?? input.endLine ?? input.end
    if (path) {
      const fileContent = extractReadContent(output)
      const fileName = path.split('/').pop() ?? path
      const lang = getLanguageFromPath(fileName)

      return fileContent ? (
        <CodeBlock code={fileContent} language={lang} className="my-0" />
      ) : null
    }
  }

  return null
}

// ============ Tool Component ============

export function Tool({
  name,
  status,
  input,
  output,
  duration,
  className,
  onClick,
  isSubagent,
  compact = false,
}: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [showFullOutput, setShowFullOutput] = React.useState(false)

  const isReadTool = isFileReadTool(name, input, output)
  const inputSummary = input && Object.keys(input).length > 0 ? getInputSummary(name, input) : null
  const hasOutput = output !== undefined && (typeof output !== 'string' || output.length > 0)
  const hasDetails = (input && Object.keys(input).length > 0 && !isReadTool) || hasOutput

  const [truncatedOutput, isOutputTruncated] = output !== undefined ? formatOutput(output) : ['', false]
  const fullOutputText =
    output !== undefined
      ? (() => {
          if (typeof output === 'string') {
            try {
              return JSON.stringify(JSON.parse(output), null, 2)
            } catch {
              return output
            }
          }
          return JSON.stringify(output, null, 2)
        })()
      : ''

  const durationLabel =
    duration !== undefined && duration > 0
      ? duration >= 60000
        ? `${Math.floor(duration / 60000)}m ${((duration % 60000) / 1000).toFixed(0)}s`
        : duration >= 1000
          ? `${(duration / 1000).toFixed(1)}s`
          : `${duration}ms`
      : null

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={isSubagent ? undefined : setIsOpen}>
      <div
        className={cn('group/tool', isSubagent && 'cursor-pointer', compact && 'border-none', className)}
        onClick={isSubagent ? onClick : undefined}
      >
        <CollapsiblePrimitive.Trigger
          className={cn(
            'w-full flex items-center gap-2 py-1 -mx-1 px-1 rounded transition-colors text-left',
            compact ? 'hover:bg-muted/20' : 'hover:bg-muted/40',
            isSubagent && 'pointer-events-none',
          )}
        >
          <ToolIcon name={name} />
          <span className="text-sm font-medium text-foreground/90 shrink-0">{name}</span>
          {inputSummary && (
            <span className="text-xs text-muted-foreground/50 truncate font-mono">{inputSummary}</span>
          )}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {durationLabel && (
              <span className="text-xs text-muted-foreground/60">{durationLabel}</span>
            )}
            {isSubagent ? (
              <svg
                className="w-4 h-4 text-muted-foreground/80"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            ) : hasDetails ? (
              <svg
                className={cn('w-4 h-4 text-muted-foreground/80 transition-transform', !isOpen && '-rotate-90')}
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            ) : null}
          </div>
        </CollapsiblePrimitive.Trigger>
        {hasDetails && !isSubagent && (
          <CollapsiblePrimitive.Panel>
            <div
              className={cn(
                'pl-5 pr-2 py-2 ml-1.5 space-y-4 text-[11px]',
                !compact && 'border-l border-border/30',
              )}
            >
              {input && Object.keys(input).length > 0 && !isReadTool && (
                <div className="space-y-1.5">
                  <p className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
                    Input
                  </p>
                  <ScrollArea
                    className={cn(
                      'rounded-lg',
                      compact ? 'border border-border/20 bg-muted/10' : 'border border-border/40 bg-muted/20',
                    )}
                  >
                    <pre className="p-3.5 text-foreground/80 leading-relaxed font-mono text-[11px] whitespace-pre-wrap wrap-break-word">
                      {JSON.stringify(input, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              {hasOutput && (
                <div className={cn('space-y-1.5', isReadTool && 'space-y-0')}>
                  {!isReadTool && (
                    <p className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
                      Output
                    </p>
                  )}
                  {renderToolOutput(name, input, output) ?? (
                    <>
                      <ScrollArea
                        className={cn(
                          'rounded-lg max-h-[400px]',
                          compact ? 'border border-border/20 bg-muted/10' : 'border border-border/40 bg-muted/20',
                        )}
                      >
                        <pre className="p-3.5 text-foreground/80 leading-relaxed font-mono text-[11px] whitespace-pre-wrap wrap-break-word">
                          {showFullOutput ? fullOutputText : truncatedOutput}
                        </pre>
                      </ScrollArea>
                      {isOutputTruncated && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowFullOutput(!showFullOutput)
                          }}
                          className="text-[10px] text-primary/70 hover:text-primary transition-colors"
                        >
                          {showFullOutput ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </CollapsiblePrimitive.Panel>
        )}
      </div>
    </CollapsiblePrimitive.Root>
  )
}
