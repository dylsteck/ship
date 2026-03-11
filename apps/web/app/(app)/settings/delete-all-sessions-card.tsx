'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@ship/ui'
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
      // Invalidate sessions cache
      mutate((key: unknown) => typeof key === 'string' && key.includes('/sessions'), undefined, { revalidate: true })
      setSuccess(`Deleted ${result?.deletedCount ?? 0} session${result?.deletedCount === 1 ? '' : 's'}`)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sessions')
    }
  }

  return (
    <Card className="border-destructive/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Delete All Sessions</CardTitle>
        <CardDescription className="text-xs">
          Permanently delete all your sessions and their data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!confirming ? (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Delete All
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <p className="text-xs text-destructive">
              This will permanently delete all your sessions. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete All'}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-500/10 px-3 py-2">
            <p className="text-xs text-emerald-600">{success}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
