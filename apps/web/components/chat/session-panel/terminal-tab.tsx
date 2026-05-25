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
    <div className="size-full bg-[#101010] flex flex-col p-3 font-mono text-sm">
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
    <div className="size-full relative bg-[#101010] p-3">
      <div className="size-full overflow-hidden">
        <div
          ref={containerRef}
          className={cn(
            'size-full [&_.xterm]:h-full [&_.xterm-viewport]:overflow-y-auto',
            status === 'connecting' && !termRef.current && 'opacity-50',
          )}
        />
      </div>
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#101010]/80">
          <span className="text-xs text-muted-foreground animate-pulse">Connecting to sandbox...</span>
        </div>
      )}
    </div>
  )
}
