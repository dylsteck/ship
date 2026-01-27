'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Server, Trash2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Sandbox {
  id: string
  taskId: string
  status: 'running' | 'stopped' | 'error'
  previewUrl?: string
  createdAt: string
}

interface SandboxesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SandboxesDialog({ open, onOpenChange }: SandboxesDialogProps) {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchSandboxes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/sandboxes')
      if (response.ok) {
        const data = await response.json()
        setSandboxes(data.sandboxes || [])
      }
    } catch (error) {
      console.error('Failed to fetch sandboxes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchSandboxes()
    }
  }, [open])

  const handleStop = async (sandboxId: string) => {
    try {
      const response = await fetch(`/api/sandboxes/${sandboxId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Sandbox stopped')
        fetchSandboxes()
      } else {
        throw new Error('Failed to stop sandbox')
      }
    } catch (error) {
      toast.error('Failed to stop sandbox')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'stopped':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Active Sandboxes
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={fetchSandboxes} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <DialogDescription>Manage your active sandbox environments.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sandboxes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active sandboxes</div>
          ) : (
            <div className="space-y-3">
              {sandboxes.map((sandbox) => (
                <Card key={sandbox.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(sandbox.status)}`} />
                        <div>
                          <p className="font-medium text-sm">Task: {sandbox.taskId.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(sandbox.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {sandbox.status}
                        </Badge>
                        {sandbox.previewUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={sandbox.previewUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {sandbox.status === 'running' && (
                          <Button variant="ghost" size="icon" onClick={() => handleStop(sandbox.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
