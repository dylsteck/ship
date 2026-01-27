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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plug, Trash2, Plus, Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

interface Connector {
  id: string
  name: string
  type: 'stdio' | 'http' | 'sse'
  config: string
  enabled: boolean
  createdAt: string
}

interface ConnectorsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectorsDialog({ open, onOpenChange }: ConnectorsDialogProps) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConnector, setNewConnector] = useState<{
    name: string
    type: 'stdio' | 'http' | 'sse'
    config: string
  }>({
    name: '',
    type: 'stdio',
    config: '',
  })

  const fetchConnectors = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/connectors')
      if (response.ok) {
        const data = await response.json()
        setConnectors(data.connectors || [])
      }
    } catch (error) {
      console.error('Failed to fetch connectors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchConnectors()
    }
  }, [open])

  const handleAdd = async () => {
    if (!newConnector.name.trim()) {
      toast.error('Please enter a name')
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConnector),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add connector')
      }

      toast.success('Connector added')
      setNewConnector({ name: '', type: 'stdio', config: '' })
      setShowAddForm(false)
      fetchConnectors()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add connector')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/connectors/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete connector')
      }

      toast.success('Connector deleted')
      fetchConnectors()
    } catch (error) {
      toast.error('Failed to delete connector')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            MCP Connectors
          </DialogTitle>
          <DialogDescription>Manage Model Context Protocol connectors for extended capabilities.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing connectors */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connectors.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {connectors.map((connector) => (
                <Card key={connector.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{connector.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {connector.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {connector.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(connector.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">No connectors configured</p>
          )}

          {/* Add form */}
          {showAddForm ? (
            <div className="border-t pt-4 space-y-3">
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={newConnector.name}
                    onChange={(e) => setNewConnector({ ...newConnector, name: e.target.value })}
                    placeholder="My MCP Server"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select
                    value={newConnector.type}
                    onValueChange={(v) => setNewConnector({ ...newConnector, type: v as 'stdio' | 'http' | 'sse' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stdio">stdio</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="sse">SSE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Config (JSON)</Label>
                  <Textarea
                    value={newConnector.config}
                    onChange={(e) => setNewConnector({ ...newConnector, config: e.target.value })}
                    placeholder='{"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]}'
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAdd} disabled={isAdding}>
                  {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Connector
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Connector
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
