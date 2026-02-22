'use client'

import * as React from 'react'
import { Button } from '@ship/ui'
import { cn } from '@ship/ui'

interface PermissionPromptProps {
  id: string
  permission: string
  description?: string
  patterns?: string[]
  status: 'pending' | 'granted' | 'denied'
  onApprove?: () => void | Promise<void>
  onDeny?: () => void | Promise<void>
}

export function PermissionPrompt({
  id,
  permission,
  description,
  patterns,
  status,
  onApprove,
  onDeny,
}: PermissionPromptProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isPending = status === 'pending'
  const isGranted = status === 'granted'
  const isDenied = status === 'denied'

  const handleApprove = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!onApprove || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onApprove()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeny = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!onDeny || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onDeny()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        isPending &&
          'border-amber-200/60 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/30',
        isGranted &&
          'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20',
        isDenied &&
          'border-red-200/60 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/20',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className={cn(
            'shrink-0 text-lg',
            isPending && 'text-amber-600 dark:text-amber-500',
            isGranted && 'text-emerald-600 dark:text-emerald-500',
            isDenied && 'text-red-600 dark:text-red-500',
          )}
        >
          {isPending ? '\u{1F512}' : isGranted ? '\u2705' : '\u274C'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground mb-0.5">
            {isPending ? 'Permission Request' : isGranted ? 'Permission Granted' : 'Permission Denied'}
          </div>
          <div className="text-sm text-muted-foreground">
            {description || `Request permission for ${permission.replace(/_/g, ' ')}`}
          </div>
          {patterns && patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {patterns.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-muted/80 text-muted-foreground"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
          {isPending && (
            <div className="flex gap-2 mt-3">
              <Button
                variant="default"
                size="sm"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending…' : 'Approve'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeny}
                disabled={isSubmitting}
              >
                Deny
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
