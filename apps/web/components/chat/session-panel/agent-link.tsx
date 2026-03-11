'use client'

const linkClass =
  'flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors group'
const iconSvg = (
  <svg
    className="w-3 h-3 shrink-0 text-muted-foreground/30 group-hover:text-primary/70"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
    />
  </svg>
)

export function AgentLink({ url, agentSessionId }: { url: string; agentSessionId?: string | null }) {
  if (!url) return null

  const baseUrl = url.replace(/\/$/, '')

  return (
    <div className="px-3 py-2 border-t border-border/10 space-y-1">
      <a
        href={baseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        title={baseUrl}
      >
        {iconSvg}
        <span className="truncate">Agent Sandbox</span>
      </a>
      <a
        href={`${baseUrl}/ui/`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        title="Sandbox Agent Inspector"
      >
        {iconSvg}
        <span className="truncate">Inspector UI</span>
      </a>
      {agentSessionId && (
        <a
          href={`${baseUrl}/ui/sessions/${encodeURIComponent(agentSessionId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="View session events in Inspector"
        >
          {iconSvg}
          <span className="truncate">Logs</span>
        </a>
      )}
    </div>
  )
}
