'use client'

import { useState, useEffect, useCallback } from 'react'
import { useIsMobile } from '@ship/ui'

const STORAGE_KEY = 'ship-right-sidebar'

export function useRightSidebar() {
  const isMobile = useIsMobile()
  const [desktopOpen, setDesktopOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore desktop preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setDesktopOpen(saved !== 'false')
    } catch {}
  }, [])

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev)
    } else {
      setDesktopOpen((prev) => {
        const next = !prev
        try {
          localStorage.setItem(STORAGE_KEY, String(next))
        } catch {}
        return next
      })
    }
  }, [isMobile])

  return {
    isMobile,
    desktopOpen,
    mobileOpen,
    setMobileOpen,
    toggle,
  }
}
