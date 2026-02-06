'use client'

import { Button } from '@ship/ui'

interface PermissionPromptProps {
  id: string
  permission: string
  description?: string
  patterns?: string[]
  status: 'pending' | 'granted' | 'denied'
  onApprove?: () => void
  onDeny?: () => void
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
  const isPending = status === 'pending'
  const isGranted = status === 'granted'
  const isDenied = status === 'denied'

  return (
    <div
      className={`border rounded-lg p-4 ${
        isPending
          ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'
          : isGranted
            ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
            : 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={isPending ? 'text-yellow-600' : isGranted ? 'text-green-600' : 'text-red-600'}>
          {isPending ? '\u{1F512}' : isGranted ? '\u2705' : '\u274C'}
        </span>
        <div className="flex-1">
          <div className="font-medium text-foreground mb-1">
            {isPending ? 'Permission Request' : isGranted ? 'Permission Granted' : 'Permission Denied'}
          </div>
          <div className="text-sm text-muted-foreground mb-1">
            {description || `Request permission for ${permission}`}
          </div>
          {patterns && patterns.length > 0 && (
            <div className="text-xs text-muted-foreground font-mono mt-1 mb-2">
              {patterns.map((p, i) => (
                <span key={i} className="inline-block bg-muted px-1.5 py-0.5 rounded mr-1 mb-1">
                  {p}
                </span>
              ))}
            </div>
          )}
          {isPending && (
            <div className="flex gap-2 mt-2">
              <Button variant="default" size="sm" onClick={onApprove}>
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={onDeny}>
                Deny
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
