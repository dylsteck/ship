'use client'

import { cn } from '@ship/ui/utils'
import { useTerminalConnection } from './use-terminal-connection'

interface TerminalTabProps {
  sessionId?: string
  sandboxStatus?: string | null
  sandboxId?: string | null
  connectionHint?: string
}

function TerminalPlaceholder({ message, showSpinner }: { message: string; showSpinner?: boolean }) {
  return (
    <div className="size-full bg-transparent flex flex-col p-3 font-mono text-sm">
      <div className="flex items-center gap-1">
        <span className="text-[#4ec9b0]">workspace</span>
        <span className="text-muted-foreground/60">$</span>
        {showSpinner && <span className="w-1.5 h-4 bg-foreground/70 animate-pulse inline-block" />}
      </div>
      <div className="mt-4 text-muted-foreground/40 text-xs">{message}</div>
    </div>
  )
}

function getUnavailableMessage(
  sessionId: string | undefined,
  isProvisioning: boolean,
  hasNoSandbox: boolean,
  connectionFailed: boolean,
  connectionHint?: string,
  errorMessage?: string | null,
): string {
  if (!sessionId) return 'Terminal unavailable — no active session'
  if (isProvisioning) return 'Sandbox provisioning...'
  if (hasNoSandbox) return 'Sandbox unavailable — send a message to start the session'
  if (connectionFailed) {
    if (errorMessage) return `Connection failed — ${errorMessage}`
    return connectionHint
      ? `Connection failed — ${connectionHint}`
      : 'Connection failed — fix any errors in the chat (e.g. GitHub access), then send a message to retry.'
  }
  return connectionHint ? `Terminal unavailable — ${connectionHint}` : 'Terminal unavailable'
}

export function TerminalTab({ sessionId, sandboxStatus, sandboxId, connectionHint }: TerminalTabProps) {
  const { containerRef, termRef, status, isProvisioning, hasNoSandbox, connectionFailed, errorMessage } =
    useTerminalConnection({ sessionId, sandboxStatus, sandboxId })

  if (status === 'unavailable') {
    const message = getUnavailableMessage(
      sessionId,
      isProvisioning,
      hasNoSandbox,
      connectionFailed,
      connectionHint,
      errorMessage,
    )
    return <TerminalPlaceholder message={message} showSpinner={isProvisioning} />
  }

  return (
    <div className="size-full relative overflow-hidden rounded-[17px] bg-[#141414]">
      <div className="size-full overflow-hidden p-3">
        <div
          ref={containerRef}
          className={cn(
            'ship-terminal-host size-full overflow-hidden',
            '[&_.xterm]:h-full [&_.xterm]:bg-[#141414]',
            '[&_.xterm-screen]:h-full [&_.xterm-viewport]:overflow-y-auto [&_.xterm-viewport]:bg-[#141414]',
            '[&_.xterm-scroll-area]:bg-[#141414] [&_.xterm-screen]:bg-[#141414]',
            status === 'connecting' && !termRef.current && 'opacity-50',
          )}
        />
      </div>
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414]/80">
          <div
            className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-zinc-300"
            aria-label="Loading terminal"
          />
        </div>
      )}
    </div>
  )
}
