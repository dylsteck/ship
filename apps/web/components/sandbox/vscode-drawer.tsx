'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface VSCodeDrawerProps {
  sandboxId: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function VSCodeDrawer({ sandboxId, isOpen, onOpenChange }: VSCodeDrawerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Reset loading state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setHasError(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  // code-server runs on port 8080 in E2B sandbox with --auth none
  const codeServerUrl = sandboxId ? `https://${sandboxId}.e2b.dev:8080` : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div
        className={`
          fixed right-0 top-0 h-full w-[800px] max-w-[90vw] z-50
          bg-white dark:bg-gray-900 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <h2 className="font-semibold text-lg dark:text-white">VS Code</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            aria-label="Close VS Code drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-60px)] relative">
          {!codeServerUrl ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p>No sandbox available</p>
                <p className="text-sm mt-2">Sandbox is provisioning...</p>
              </div>
            </div>
          ) : hasError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p>Failed to load VS Code</p>
                <p className="text-sm mt-2">code-server may not be ready yet</p>
                <button
                  onClick={() => {
                    setHasError(false)
                    setIsLoading(true)
                  }}
                  className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      Loading VS Code...
                    </p>
                  </div>
                </div>
              )}
              <iframe
                src={codeServerUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                allow="clipboard-read; clipboard-write"
                title="VS Code Server"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
