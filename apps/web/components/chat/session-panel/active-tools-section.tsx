'use client'

export function ActiveToolsSection({ tools }: { tools: Array<{ toolCallId: string; toolName: string; title?: string }> }) {
  if (tools.length === 0) return null

  return (
    <div className="px-3 py-2 border-b border-border/10">
      <div className="space-y-1">
        {tools.map((tool, index) => (
          <div key={`${tool.toolCallId}-${index}`} className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-[10px] text-foreground/70 font-medium truncate">{tool.toolName}</span>
            {tool.title && <span className="text-[9px] text-muted-foreground/40 truncate">{tool.title}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
