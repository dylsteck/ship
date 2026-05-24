'use client'

import { useState, useCallback, useEffect } from 'react'
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

  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [activeTab, setActiveTabState] = useState<RightSidebarTab>('git')

  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setDesktopOpen(readStorage(STORAGE_KEY, 'false') !== 'false')
    setExpanded(readStorage(EXPANDED_STORAGE_KEY, 'false') === 'true')

    const savedTab = readStorage(TAB_STORAGE_KEY, 'git')
    const valid: RightSidebarTab[] = ['git', 'terminal']
    setActiveTabState(valid.includes(savedTab as RightSidebarTab) ? (savedTab as RightSidebarTab) : 'git')
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
