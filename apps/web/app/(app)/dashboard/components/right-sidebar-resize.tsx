'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const DEFAULT_SIDEBAR_WIDTH = 430
const MIN_SIDEBAR_WIDTH = 360
const MAX_SIDEBAR_WIDTH = 760
const RESIZE_STEP = 24

function getMaxSidebarWidth() {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.72))
}

/** Manages bounded desktop resizing for the session right sidebar. */
export function useResizableSidebarWidth() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const stopResizeRef = useRef<(() => void) | null>(null)

  const handleResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    stopResizeRef.current?.()

    const resize = (moveEvent: PointerEvent) => {
      const maxWidth = getMaxSidebarWidth()
      const nextWidth = Math.min(Math.max(window.innerWidth - moveEvent.clientX, MIN_SIDEBAR_WIDTH), maxWidth)
      setSidebarWidth(nextWidth)
    }

    const stopResize = () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      stopResizeRef.current = null
      setIsResizing(false)
    }

    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    stopResizeRef.current = stopResize
  }, [])

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const maxWidth = getMaxSidebarWidth()
    const clampWidth = (width: number) => Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), maxWidth)

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setSidebarWidth((width) => clampWidth(width + RESIZE_STEP))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setSidebarWidth((width) => clampWidth(width - RESIZE_STEP))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setSidebarWidth(MIN_SIDEBAR_WIDTH)
    } else if (event.key === 'End') {
      event.preventDefault()
      setSidebarWidth(maxWidth)
    }
  }, [])

  useEffect(() => {
    return () => stopResizeRef.current?.()
  }, [])

  return { sidebarWidth, isResizing, handleResizePointerDown, handleResizeKeyDown }
}

/** Left-edge drag and keyboard resize affordance for the session right sidebar. */
export function ResizeHandle({
  width,
  onPointerDown,
  onKeyDown,
}: {
  width: number
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="separator"
      aria-label="Resize session sidebar"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group absolute bottom-3 left-3 top-[3.375rem] z-20 w-3 -translate-x-1/2 cursor-col-resize focus-visible:outline-none"
    >
      <div className="ml-1.5 h-full w-px bg-emerald-300/0 transition-colors group-hover:bg-emerald-300/40 group-focus-visible:bg-emerald-300/60" />
    </div>
  )
}
