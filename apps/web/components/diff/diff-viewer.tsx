'use client'

import { useMemo } from 'react'
import { DiffView } from '@git-diff-view/react'
import { parseDiff } from '@git-diff-view/file'

interface DiffViewerProps {
  diff: string
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const files = useMemo(() => {
    if (!diff || diff.trim() === '') return []

    try {
      return parseDiff(diff)
    } catch (error) {
      console.error('Failed to parse diff:', error)
      return []
    }
  }, [diff])

  if (files.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 border rounded-lg dark:border-gray-700">
        No changes to display
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden dark:border-gray-700">
      {files.map((file, index) => (
        <div key={index} className={index > 0 ? 'border-t dark:border-gray-700' : ''}>
          <DiffView
            diff={file}
            options={{
              highlight: true,
              showHeader: true,
            }}
          />
        </div>
      ))}
    </div>
  )
}
