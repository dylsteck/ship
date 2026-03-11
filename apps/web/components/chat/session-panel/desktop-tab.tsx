'use client'

import { useState } from 'react'
import { cn, Skeleton } from '@ship/ui'

interface DesktopTabProps {
  agentUrl?: string
  sandboxStatus?: string
}

export function DesktopTab({ agentUrl, sandboxStatus }: DesktopTabProps) {
  const [iframeError, setIframeError] = useState(false)
  const isProvisioning = sandboxStatus === 'provisioning' || sandboxStatus === 'resuming'
  const hasUrl = Boolean(agentUrl) && !iframeError

  if (isProvisioning) {
    return (
      <div className="flex flex-col items-center justify-center size-full gap-3 p-6">
        <Skeleton className="size-full rounded-md" />
      </div>
    )
  }

  if (!hasUrl) {
    return (
      <div className="flex flex-col items-center justify-center size-full gap-3 p-6">
        <p className="text-sm text-muted-foreground">Could not connect to Desktop</p>
        <button
          onClick={() => setIframeError(false)}
          className={cn(
            'px-4 py-1.5 text-sm rounded-md border border-border',
            'text-foreground hover:bg-muted/50 transition-colors',
          )}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <iframe
      src={`${agentUrl!.replace(/\/$/, '')}/ui/`}
      className="size-full border-0"
      allow="clipboard-read; clipboard-write"
      onError={() => setIframeError(true)}
      title="Sandbox Desktop"
    />
  )
}
