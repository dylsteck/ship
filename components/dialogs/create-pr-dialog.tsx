'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { GitPullRequest, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CreatePRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  repoUrl?: string
  branch?: string
  baseBranch?: string
}

export function CreatePRDialog({
  open,
  onOpenChange,
  taskId,
  repoUrl,
  branch = 'main',
  baseBranch = 'main',
}: CreatePRDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/github/pull-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          title: title.trim(),
          body: description.trim(),
          head: branch,
          base: baseBranch,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create pull request')
      }

      const result = await response.json()
      toast.success('Pull request created!')
      if (result.url) {
        window.open(result.url, '_blank')
      }
      onOpenChange(false)
      setTitle('')
      setDescription('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create pull request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            Create Pull Request
          </DialogTitle>
          <DialogDescription>Create a pull request with the changes from this task.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add feature X"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your changes..."
                rows={4}
              />
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                <strong>From:</strong> {branch}
              </span>
              <span>
                <strong>To:</strong> {baseBranch}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Pull Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
