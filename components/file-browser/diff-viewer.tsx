'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface DiffViewerProps {
  oldContent: string
  newContent: string
  oldFileName?: string
  newFileName?: string
  splitView?: boolean
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed'
  oldLine?: number
  newLine?: number
  content: string
}

function computeSimpleDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffLine[] = []

  let oldIndex = 0
  let newIndex = 0

  // Simple LCS-based diff
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      // All remaining new lines are additions
      result.push({
        type: 'added',
        newLine: newIndex + 1,
        content: newLines[newIndex] || '',
      })
      newIndex++
    } else if (newIndex >= newLines.length) {
      // All remaining old lines are removals
      result.push({
        type: 'removed',
        oldLine: oldIndex + 1,
        content: oldLines[oldIndex] || '',
      })
      oldIndex++
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      // Lines match
      result.push({
        type: 'unchanged',
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
        content: oldLines[oldIndex] || '',
      })
      oldIndex++
      newIndex++
    } else {
      // Lines differ - mark old as removed, new as added
      result.push({
        type: 'removed',
        oldLine: oldIndex + 1,
        content: oldLines[oldIndex] || '',
      })
      oldIndex++
    }
  }

  // Handle remaining new lines that weren't matched
  const processedNewLines = new Set(result.filter((l) => l.newLine).map((l) => l.newLine))
  for (let i = 0; i < newLines.length; i++) {
    if (!processedNewLines.has(i + 1)) {
      // Find the right position to insert
      const insertIndex = result.findIndex((l) => (l.newLine || 0) > i + 1 || (l.oldLine || 0) > i + 1)
      if (insertIndex === -1) {
        result.push({
          type: 'added',
          newLine: i + 1,
          content: newLines[i] || '',
        })
      }
    }
  }

  return result
}

export function DiffViewer({
  oldContent,
  newContent,
  oldFileName = 'original',
  newFileName = 'modified',
  splitView = false,
}: DiffViewerProps) {
  const diffLines = useMemo(() => computeSimpleDiff(oldContent, newContent), [oldContent, newContent])

  return (
    <div className="h-full overflow-auto font-mono text-sm">
      {/* Header */}
      <div className="flex border-b bg-muted/50 sticky top-0">
        <div className="flex-1 px-3 py-2 text-muted-foreground text-xs truncate">{oldFileName}</div>
        <div className="flex-1 px-3 py-2 text-muted-foreground text-xs truncate">{newFileName}</div>
      </div>

      {/* Diff content */}
      <div className="divide-y">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'flex',
              line.type === 'added' && 'bg-green-500/10',
              line.type === 'removed' && 'bg-red-500/10'
            )}
          >
            {/* Line numbers */}
            <div className="w-12 px-2 py-0.5 text-right text-muted-foreground text-xs select-none border-r bg-muted/30">
              {line.oldLine || ''}
            </div>
            <div className="w-12 px-2 py-0.5 text-right text-muted-foreground text-xs select-none border-r bg-muted/30">
              {line.newLine || ''}
            </div>

            {/* Change indicator */}
            <div
              className={cn(
                'w-6 px-1 py-0.5 text-center select-none',
                line.type === 'added' && 'text-green-600',
                line.type === 'removed' && 'text-red-600'
              )}
            >
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ''}
            </div>

            {/* Content */}
            <div className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto">
              {line.content}
            </div>
          </div>
        ))}
      </div>

      {diffLines.length === 0 && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">No differences</div>
      )}
    </div>
  )
}
