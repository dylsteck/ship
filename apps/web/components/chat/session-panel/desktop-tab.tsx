'use client'

import { useEffect } from 'react'
import { cn, Skeleton } from '@ship/ui'
import { useDesktopStream, useStartDesktopStream, useStopDesktopStream } from '@/lib/api/hooks/use-desktop'

interface DesktopTabProps {
  sessionId: string
  sandboxStatus?: string
}

export function DesktopTab({ sessionId, sandboxStatus }: DesktopTabProps) {
  const { streamUrl, isActive, isLoading: isCheckingStream, mutate } = useDesktopStream(sessionId)
  const { startStream, isStarting } = useStartDesktopStream()
  const { stopStream, isStopping } = useStopDesktopStream()

  const isProvisioning = sandboxStatus === 'provisioning' || sandboxStatus === 'resuming'
  const isSandboxReady = sandboxStatus === 'active' || sandboxStatus === 'ready'

  // Re-check stream status when sandbox becomes ready
  useEffect(() => {
    if (isSandboxReady) {
      mutate()
    }
  }, [isSandboxReady, mutate])

  if (isProvisioning) {
    return (
      <div className="flex flex-col items-center justify-center size-full gap-3 p-6">
        <Skeleton className="size-full rounded-md" />
      </div>
    )
  }

  if (!isSandboxReady) {
    return (
      <div className="flex flex-col items-center justify-center size-full gap-3 p-6">
        <p className="text-sm text-muted-foreground">Waiting for sandbox...</p>
      </div>
    )
  }

  // Stream active — show interactive desktop
  if (isActive && streamUrl) {
    return (
      <div className="flex flex-col size-full">
        <div className="flex items-center justify-end px-2 py-1 border-b border-border/40 shrink-0">
          <button
            onClick={async () => {
              await stopStream({ sessionId })
              mutate()
            }}
            disabled={isStopping}
            className={cn(
              'px-3 py-1 text-xs rounded-md border border-border',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
              isStopping && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isStopping ? 'Stopping...' : 'Stop Desktop'}
          </button>
        </div>
        <iframe
          src={streamUrl}
          className="flex-1 w-full border-0"
          allow="clipboard-read; clipboard-write"
          title="Sandbox Desktop"
        />
      </div>
    )
  }

  // Sandbox ready, no stream — show start button
  return (
    <div className="flex flex-col items-center justify-center size-full gap-3 p-6">
      {isCheckingStream ? (
        <Skeleton className="h-9 w-32 rounded-md" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Launch an interactive desktop session
          </p>
          <button
            onClick={async () => {
              await startStream({ sessionId })
              mutate()
            }}
            disabled={isStarting}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md border border-border',
              'text-foreground hover:bg-muted/50 transition-colors',
              isStarting && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isStarting ? 'Starting...' : 'Start Desktop'}
          </button>
        </>
      )}
    </div>
  )
}
