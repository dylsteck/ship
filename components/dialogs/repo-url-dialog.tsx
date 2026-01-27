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
import { Label } from '@/components/ui/label'
import { Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RepoUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (url: string) => void
}

export function RepoUrlDialog({ open, onOpenChange, onSubmit }: RepoUrlDialogProps) {
  const [url, setUrl] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const validateGitHubUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      toast.error('Please enter a repository URL')
      return
    }

    if (!validateGitHubUrl(trimmedUrl)) {
      toast.error('Please enter a valid GitHub repository URL')
      return
    }

    setIsValidating(true)
    try {
      // Normalize the URL
      const normalizedUrl = trimmedUrl.replace(/\.git$/, '').replace(/\/$/, '')
      onSubmit(normalizedUrl)
      onOpenChange(false)
      setUrl('')
    } catch (error) {
      toast.error('Invalid repository URL')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Open Repository URL
          </DialogTitle>
          <DialogDescription>Enter a GitHub repository URL to open it directly.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                type="url"
              />
              <p className="text-xs text-muted-foreground">Example: https://github.com/vercel/next.js</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isValidating}>
              {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
