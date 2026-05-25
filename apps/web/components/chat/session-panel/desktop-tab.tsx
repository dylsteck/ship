'use client'

import { useState } from 'react'
import { cn } from '@ship/ui'
import { useDesktopState } from '@/lib/api/hooks/use-chat'

interface DesktopTabProps {
  sessionId?: string
  sandboxStatus?: string | null
}

function DesktopStatusView({
  title,
  message,
  loading,
  quiet,
  onRetry,
}: {
  title: string
  message: string
  loading?: boolean
  quiet?: boolean
  onRetry?: () => void
}) {
  return (
    <div className="flex size-full items-center justify-center px-6 text-center">
      <div className="max-w-[280px]">
        {quiet && loading ? (
          <div className="mx-auto size-5 animate-spin rounded-full border-2 border-white/10 border-t-zinc-300" aria-label="Loading desktop" />
        ) : loading ? (
          <div className="mx-auto mb-3 flex size-8 items-center justify-center rounded-full bg-white/[0.06]">
            <span
              className={cn('block size-2 rounded-full bg-zinc-500', loading && 'animate-pulse bg-emerald-400')}
              aria-hidden="true"
            />
          </div>
        ) : null}
        {!quiet && (
          <>
            <div className="text-sm font-medium text-zinc-200">{title}</div>
            {message && <div className="mt-1 text-xs leading-5 text-zinc-500">{message}</div>}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function DesktopTab({ sessionId, sandboxStatus }: DesktopTabProps) {
  const [retryToken, setRetryToken] = useState(0)
  const { desktopState, isLoading, isFetching } = useDesktopState(sessionId, retryToken)
  const unavailable = !sessionId || sandboxStatus === 'pending' || sandboxStatus === 'error'

  if (unavailable) {
    return (
      <DesktopStatusView
        title="Desktop unavailable"
        message="Send a message to start the sandbox, then open Desktop again."
      />
    )
  }

  if (isLoading || isFetching || desktopState?.status === 'starting') {
    return (
      <DesktopStatusView
        title="Starting desktop"
        message="Preparing a browser-accessible desktop in this session sandbox."
        loading
        quiet
      />
    )
  }

  if (desktopState?.status === 'error' || desktopState?.status === 'unavailable' || !desktopState?.url) {
    return (
      <DesktopStatusView
        title={desktopState?.status === 'unavailable' ? 'Desktop unavailable' : 'Desktop failed to start'}
        message=""
        onRetry={() => {
          setRetryToken((value) => value + 1)
        }}
      />
    )
  }

  return (
    <div className="size-full overflow-hidden rounded-[17px] bg-[#141414]">
      <iframe
        src={desktopState.url}
        title="Sandbox desktop"
        className="size-full border-0 bg-[#141414]"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  )
}
