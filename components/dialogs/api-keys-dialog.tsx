'use client'

import { useState, useEffect } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Key, Trash2, Plus, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (Codex)' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'gemini', label: 'Google (Gemini)' },
  { value: 'aigateway', label: 'AI Gateway' },
] as const

type Provider = (typeof PROVIDERS)[number]['value']

interface ApiKey {
  id: string
  provider: Provider
  createdAt: string
}

interface ApiKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeysDialog({ open, onOpenChange }: ApiKeysDialogProps) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newProvider, setNewProvider] = useState<Provider>('anthropic')
  const [newValue, setNewValue] = useState('')
  const [showValue, setShowValue] = useState(false)

  const fetchKeys = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/user/keys')
      if (response.ok) {
        const data = await response.json()
        setKeys(data.keys || [])
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchKeys()
    }
  }, [open])

  const handleAdd = async () => {
    if (!newValue.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          value: newValue.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save key')
      }

      toast.success('API key saved')
      setNewValue('')
      fetchKeys()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save key')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (provider: Provider) => {
    try {
      const response = await fetch(`/api/user/keys?provider=${provider}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete key')
      }

      toast.success('API key deleted')
      fetchKeys()
    } catch (error) {
      toast.error('Failed to delete key')
    }
  }

  const getProviderLabel = (provider: string) => {
    return PROVIDERS.find((p) => p.value === provider)?.label || provider
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </DialogTitle>
          <DialogDescription>Manage your API keys for different AI providers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing keys */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length > 0 ? (
            <div className="space-y-2">
              {keys.map((key) => (
                <Card key={key.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{getProviderLabel(key.provider)}</p>
                      <p className="text-xs text-muted-foreground">
                        Added: {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(key.provider)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">No API keys configured</p>
          )}

          {/* Add new key */}
          <div className="border-t pt-4 space-y-3">
            <Label>Add New Key</Label>
            <div className="flex gap-2">
              <Select value={newProvider} onValueChange={(v) => setNewProvider(v as Provider)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Input
                  type={showValue ? 'text' : 'password'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowValue(!showValue)}
                >
                  {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleAdd} disabled={isAdding} className="w-full">
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
