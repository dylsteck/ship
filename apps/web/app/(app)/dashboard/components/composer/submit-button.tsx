'use client'

import { Button, cn } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp02Icon, StopIcon } from '@hugeicons/core-free-icons'
import { useComposer } from './composer-context'

export function SubmitButton({ size = 'default' }: { size?: 'default' | 'small' }) {
  const { activeSessionId, isStreaming, isCreating, onSubmit, onStop, canSubmit } = useComposer()

  if (activeSessionId && isStreaming) {
    return (
      <Button
        onClick={onStop}
        size="icon-sm"
        className={cn(
          'rounded-full bg-foreground text-background hover:bg-foreground/90',
          size === 'small' ? 'h-6 w-6' : '',
        )}
      >
        <HugeiconsIcon icon={StopIcon} strokeWidth={2} className="size-3.5" />
      </Button>
    )
  }

  return (
    <Button
      onClick={onSubmit}
      disabled={!canSubmit}
      size="icon-sm"
      className={cn(
        'rounded-full transition-all',
        size === 'small' ? 'h-6 w-6' : '',
        canSubmit
          ? 'bg-foreground text-background hover:bg-foreground/90'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {isCreating ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} className={size === 'small' ? 'size-3.5' : ''} />
      )}
    </Button>
  )
}
