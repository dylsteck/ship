'use client'

import { PatchDiff } from '@pierre/diffs/react'

interface DiffViewerProps {
  diff: string
}

export function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff || diff.trim() === '') {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 border rounded-lg dark:border-gray-700">
        No changes to display
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden dark:border-gray-700">
      <PatchDiff
        patch={diff}
        options={{
          theme: { dark: 'pierre-dark', light: 'pierre-light' },
          diffStyle: 'split',
        }}
      />
    </div>
  )
}
