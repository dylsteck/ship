'use client'

import React from 'react'

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps {
  side?: 'left' | 'right' | 'top' | 'bottom'
  className?: string
  children: React.ReactNode
}

interface SheetHeaderProps {
  children: React.ReactNode
  className?: string
}

interface SheetTitleProps {
  children: React.ReactNode
  className?: string
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </>
  )
}

export function SheetContent({ side = 'right', className = '', children }: SheetContentProps) {
  const sideStyles = {
    left: 'left-0 top-0 h-full w-[400px] border-r',
    right: 'right-0 top-0 h-full w-[400px] border-l',
    top: 'top-0 left-0 w-full h-[400px] border-b',
    bottom: 'bottom-0 left-0 w-full h-[400px] border-t',
  }

  return (
    <div
      className={`fixed z-50 bg-white dark:bg-gray-900 shadow-lg ${sideStyles[side]} ${className}`}
    >
      {children}
    </div>
  )
}

export function SheetHeader({ children, className = '' }: SheetHeaderProps) {
  return (
    <div className={`flex flex-col space-y-2 p-6 ${className}`}>
      {children}
    </div>
  )
}

export function SheetTitle({ children, className = '' }: SheetTitleProps) {
  return (
    <h2 className={`text-lg font-semibold ${className}`}>
      {children}
    </h2>
  )
}
