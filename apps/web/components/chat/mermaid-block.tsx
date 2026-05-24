'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { mermaid as mermaidPlugin } from '@streamdown/mermaid'
import { cn } from '@ship/ui'
import type { CustomRendererProps } from 'streamdown'
import { MermaidActions } from './mermaid-actions'

interface MermaidBlockProps {
  chart: string
  className?: string
}

const DEFAULT_MERMAID_ZOOM = 1.45

/** Renders Mermaid diagrams with Ship-owned copy and fullscreen actions. */
export function MermaidBlockRenderer({ code, isIncomplete }: CustomRendererProps) {
  if (isIncomplete) {
    return (
      <div className="my-4 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Rendering diagram...
      </div>
    )
  }

  return <MermaidBlock chart={code} />
}

function MermaidBlock({ chart, className }: MermaidBlockProps) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <div
      className={cn(
        'group relative my-4 w-full overflow-hidden rounded-lg border border-border bg-background',
        className,
      )}
      data-ship-mermaid-block=""
    >
      <div className="flex h-11 items-center justify-between border-b border-border bg-muted/35 px-4">
        <span className="font-mono text-xs text-muted-foreground">mermaid</span>
        <MermaidActions chart={chart} onFullscreen={() => setFullscreen(true)} />
      </div>
      <div className="p-4">
        <MermaidSvg chart={chart} className="min-h-72" />
      </div>
      {fullscreen ? <MermaidFullscreenOverlay chart={chart} onClose={() => setFullscreen(false)} /> : null}
    </div>
  )
}

interface MermaidSvgProps {
  chart: string
  className?: string
}

function MermaidSvg({ chart, className }: MermaidSvgProps) {
  const { error, svg } = useRenderedMermaid(chart)
  const canvas = useMermaidCanvas(chart)

  if (error) {
    return <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">{error}</div>
  }

  if (!svg) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
        Rendering diagram...
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex w-full touch-none select-none items-center justify-center overflow-hidden',
        canvas.isPanning ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      onPointerCancel={canvas.finishPan}
      onPointerDown={canvas.handlePointerDown}
      onPointerMove={canvas.handlePointerMove}
      onPointerUp={canvas.finishPan}
    >
      <div className="absolute left-4 top-4 z-10 flex overflow-hidden rounded-lg border border-border/80 bg-background/95 p-1 shadow-xl">
        <ZoomButton label="Zoom in" onClick={() => canvas.setZoom((value) => Math.min(2.5, value + 0.15))}>
          +
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => canvas.setZoom((value) => Math.max(0.4, value - 0.15))}>
          -
        </ZoomButton>
      </div>
      <div
        aria-label="Mermaid chart"
        className={cn(
          'mermaid-rendered-svg flex items-center justify-center',
          !canvas.isPanning && 'transition-transform duration-150',
        )}
        dangerouslySetInnerHTML={{ __html: svg }}
        role="img"
        style={{
          transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.zoom})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  )
}

function useRenderedMermaid(chart: string) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function renderChart() {
      try {
        setError(null)
        setSvg(null)
        const mermaid = mermaidPlugin.getMermaid()
        const result = await mermaid.render(createMermaidId(chart), chart)
        if (isActive) setSvg(result.svg)
      } catch (renderError) {
        if (isActive) {
          setError(renderError instanceof Error ? renderError.message : 'Failed to render Mermaid diagram')
        }
      }
    }

    void renderChart()
    return () => {
      isActive = false
    }
  }, [chart])

  return { error, svg }
}

function useMermaidCanvas(chart: string) {
  const [zoom, setZoom] = useState(DEFAULT_MERMAID_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const dragRef = useRef<{
    originX: number
    originY: number
    pointerId: number
    startX: number
    startY: number
  } | null>(null)

  useEffect(() => {
    setZoom(DEFAULT_MERMAID_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [chart])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element | null)?.closest('button')) return
    dragRef.current = {
      originX: pan.x,
      originY: pan.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPan({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY })
  }

  const finishPan = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsPanning(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return { finishPan, handlePointerDown, handlePointerMove, isPanning, pan, setZoom, zoom }
}

interface ZoomButtonProps {
  children: ReactNode
  label: string
  onClick: () => void
}

function ZoomButton({ children, label, onClick }: ZoomButtonProps) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-9 w-12 items-center justify-center rounded-md font-mono text-2xl leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

interface MermaidFullscreenOverlayProps {
  chart: string
  onClose: () => void
}

function MermaidFullscreenOverlay({ chart, onClose }: MermaidFullscreenOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[10000] flex bg-background/95 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4">
          <span className="font-mono text-xs text-muted-foreground">mermaid</span>
          <MermaidActions chart={chart} onClose={onClose} />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          <MermaidSvg chart={chart} className="mermaid-fullscreen-svg size-full" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function createMermaidId(chart: string): string {
  return `ship-mermaid-${Math.abs(hashString(chart))}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hashString(value: string): number {
  return value.split('').reduce((hash, character) => (hash << 5) - hash + character.charCodeAt(0), 0)
}
