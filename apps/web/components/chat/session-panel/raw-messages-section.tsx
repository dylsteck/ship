'use client'

import { useState } from 'react'
import { cn } from '@ship/ui/utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import type { UIMessage } from '@/lib/ai-elements-adapter'

export function RawMessagesSection({ messages }: { messages: UIMessage[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!messages.length) return null

  return (
    <CollapsiblePrimitive.Root>
      <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          Messages ({messages.length})
        </span>
        <svg className="w-3 h-3 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel>
        <div className="px-3 pb-3 space-y-px max-h-80 overflow-y-auto">
          {messages.map((msg) => {
            const isExpanded = expandedId === msg.id
            const toolCount = msg.toolInvocations?.length || 0
            const hasReasoning = (msg.reasoning?.length || 0) > 0
            const contentPreview = msg.content
              ? msg.content.slice(0, 80).replace(/\n/g, ' ') + (msg.content.length > 80 ? '...' : '')
              : null

            return (
              <div key={msg.id} className={cn('rounded-md transition-colors', isExpanded && 'bg-muted/20')}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                  className="w-full flex items-start justify-between px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors text-left gap-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-[9px] font-mono px-1.5 py-0.5 rounded font-medium shrink-0',
                          msg.role === 'user'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : msg.role === 'assistant'
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {msg.role}
                      </span>
                      {msg.type && msg.type !== 'error' && (
                        <span className="text-[8px] text-muted-foreground/40 font-mono">{msg.type}</span>
                      )}
                      {msg.type === 'error' && (
                        <span className="text-[8px] text-red-500/70 font-mono">error</span>
                      )}
                      {msg.createdAt && (
                        <span className="text-[9px] text-muted-foreground/30 ml-auto shrink-0">
                          {msg.createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {contentPreview && (
                      <span className="text-[9px] text-muted-foreground/40 truncate leading-tight">
                        {contentPreview}
                      </span>
                    )}
                  </div>
                  <svg
                    className={cn('w-3 h-3 text-muted-foreground/30 transition-transform shrink-0 mt-0.5', isExpanded && 'rotate-180')}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {/* Summary badges */}
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/50">
                        id: {msg.id.slice(0, 12)}
                      </span>
                      {toolCount > 0 && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500/70">
                          {toolCount} tool{toolCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {hasReasoning && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500/70">
                          reasoning
                        </span>
                      )}
                      {msg.elapsed && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/50">
                          {msg.elapsed >= 1000 ? `${(msg.elapsed / 1000).toFixed(1)}s` : `${msg.elapsed}ms`}
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    {msg.content && (
                      <div>
                        <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Content</div>
                        <pre className="text-[9px] font-mono text-muted-foreground/60 bg-muted/30 rounded p-1.5 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                          {msg.content.slice(0, 1000)}{msg.content.length > 1000 ? '\n...' : ''}
                        </pre>
                      </div>
                    )}

                    {/* Tool invocations */}
                    {toolCount > 0 && (
                      <div>
                        <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Tools</div>
                        <div className="space-y-0.5">
                          {msg.toolInvocations!.map((t) => (
                            <div key={t.toolCallId} className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 bg-muted/30 rounded px-1.5 py-1">
                              <span className={cn(
                                'w-1 h-1 rounded-full shrink-0',
                                t.state === 'result' ? 'bg-green-500/70' : t.state === 'error' ? 'bg-red-500/70' : 'bg-muted-foreground/30',
                              )} />
                              <span className="text-foreground/70 font-medium">{t.toolName}</span>
                              {t.duration !== undefined && (
                                <span className="text-muted-foreground/30 ml-auto">
                                  {t.duration >= 1000 ? `${(t.duration / 1000).toFixed(1)}s` : `${t.duration}ms`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reasoning preview */}
                    {hasReasoning && (
                      <div>
                        <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Reasoning</div>
                        <pre className="text-[9px] font-mono text-muted-foreground/60 bg-muted/30 rounded p-1.5 overflow-x-auto max-h-20 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                          {msg.reasoning!.join('\n').slice(0, 500)}{msg.reasoning!.join('\n').length > 500 ? '\n...' : ''}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}
