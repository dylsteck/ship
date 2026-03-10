'use client'

import { useState, useCallback } from 'react'
import { useIsMobile } from '@ship/ui'
import type { RightSidebarTab } from '../types'

const STORAGE_KEY = 'ship-right-sidebar'
const TAB_STORAGE_KEY = 'ship-right-sidebar-tab'
const EXPANDED_STORAGE_KEY = 'ship-right-sidebar-expanded'

function readStorage(key: string, fallback: string): string {
  try {
    const val = localStorage.getItem(key)
    return val ?? fallback
  } catch {
    return fallback
  }
}

export function useRightSidebar() {
  const isMobile = useIsMobile()

  const [desktopOpen, setDesktopOpen] = useState(() =>
    readStorage(STORAGE_KEY, 'false') !== 'false',
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  const [activeTab, setActiveTabState] = useState<RightSidebarTab>(() => {
    const saved = readStorage(TAB_STORAGE_KEY, 'overview')
    const valid: RightSidebarTab[] = ['git', 'desktop', 'terminal', 'overview']
    return valid.includes(saved as RightSidebarTab)
      ? (saved as RightSidebarTab)
      : 'overview'
  })

  const [expanded, setExpanded] = useState(() =>
    readStorage(EXPANDED_STORAGE_KEY, 'false') === 'true',
  )

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

  const setActiveTab = useCallback((tab: RightSidebarTab) => {
    setActiveTabState(tab)
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab)
    } catch {}
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      try {
        localStorage.setItem(EXPANDED_STORAGE_KEY, String(next))
      } catch {}
      return next
    })
  }, [])

  return {
    isMobile,
    desktopOpen,
    mobileOpen,
    setMobileOpen,
    toggle,
    activeTab,
    setActiveTab,
    expanded,
    toggleExpanded,
  }
}
