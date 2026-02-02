'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { SourceCodeIcon, Terminal } from '@hugeicons/core-free-icons'

interface SandboxToolbarProps {
  sandboxId: string | null
  sandboxStatus: 'provisioning' | 'ready' | 'error' | 'none'
  onOpenVSCode: () => void
  onOpenTerminal: () => void
}

export function SandboxToolbar({
  sandboxId,
  sandboxStatus,
  onOpenVSCode,
  onOpenTerminal,
}: SandboxToolbarProps) {
  const isDisabled = !sandboxId || sandboxStatus !== 'ready'

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      {sandboxStatus === 'provisioning' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900 dark:border-white" />
          <span>Sandbox provisioning...</span>
        </div>
      )}

      {/* VS Code button */}
      <button
        onClick={onOpenVSCode}
        disabled={isDisabled}
        className={`
          p-2 rounded-md transition-colors
          ${
            isDisabled
              ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }
        `}
        title={isDisabled ? 'Sandbox not ready' : 'Open VS Code'}
        aria-label="Open VS Code"
      >
        <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} className="size-4" />
      </button>

      {/* Terminal button */}
      <button
        onClick={onOpenTerminal}
        disabled={isDisabled}
        className={`
          p-2 rounded-md transition-colors
          ${
            isDisabled
              ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }
        `}
        title={isDisabled ? 'Sandbox not ready' : 'Open Terminal'}
        aria-label="Open Terminal"
      >
        <HugeiconsIcon icon={Terminal} strokeWidth={2} className="size-4" />
      </button>
    </div>
  )
}
