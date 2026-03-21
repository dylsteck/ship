'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { Button } from '@ship/ui'
import { useDeleteAllSessions } from '@/lib/api/hooks/use-sessions'

interface DeleteAllSessionsCardProps {
  userId: string
}

export function DeleteAllSessionsCard({ userId }: DeleteAllSessionsCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { deleteAllSessions, isDeleting } = useDeleteAllSessions()
  const { mutate } = useSWRConfig()

  const handleConfirm = async () => {
    try {
      setError(null)
      const result = await deleteAllSessions({ userId })
      setConfirming(false)
      mutate((key: unknown) => typeof key === 'string' && key.includes('/sessions'), undefined, { revalidate: true })
      setSuccess(`Deleted ${result?.deletedCount ?? 0} session${result?.deletedCount === 1 ? '' : 's'}`)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sessions')
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Delete All Sessions</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently delete all your sessions and their data
          </p>
        </div>
        <div className="shrink-0">
          {!confirming ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirming(true)}
              className="h-8 text-xs"
            >
              Delete All
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={isDeleting}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={isDeleting}
                className="h-8 text-xs"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </Button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 px-3 py-1.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-2 rounded-md bg-emerald-500/10 px-3 py-1.5">
          <p className="text-xs text-emerald-600">{success}</p>
        </div>
      )}
    </div>
  )
}
