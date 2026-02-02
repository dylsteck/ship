'use client'

import React, { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface VSCodeDrawerProps {
  sandboxId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function VSCodeDrawer({ sandboxId, isOpen, onOpenChange }: VSCodeDrawerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const iframeUrl = `https://${sandboxId}.e2b.dev:8080`

  const handleIframeLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[800px] p-0">
        <SheetHeader className="border-b">
          <SheetTitle>VS Code</SheetTitle>
        </SheetHeader>

        <div className="relative h-[calc(100%-73px)]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading VS Code...</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <div className="text-center max-w-md p-6">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">Failed to load VS Code</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  The sandbox may not be ready yet. Please try again in a moment.
                </p>
              </div>
            </div>
          )}

          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="VS Code"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
