'use client'

import { useState, useCallback, useEffect } from 'react'
import { useIsMobile } from '@ship/ui'
import type { RightSidebarTab } from '../types'

const STORAGE_KEY = 'ship-right-sidebar'
const EXPANDED_STORAGE_KEY = 'ship-right-sidebar-expanded'

function readStorage(key: string, fallback: string): string {
  try {
    const val = localStorage.getItem(key)
    return val ?? fallback
  } catch {
    return fallback
  }
}

export function useRightSidebar(activeSessionId?: string | null) {
  const isMobile = useIsMobile()

  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [activeTab, setActiveTabState] = useState<RightSidebarTab>('git')

  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setDesktopOpen(readStorage(STORAGE_KEY, 'false') !== 'false')
    setExpanded(readStorage(EXPANDED_STORAGE_KEY, 'false') === 'true')
  }, [])

  useEffect(() => {
    if (activeSessionId) setActiveTabState('git')
  }, [activeSessionId])

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

  const openMobilePanel = useCallback(
    (tab: RightSidebarTab = 'git') => {
      setActiveTab(tab)
      setMobileOpen(true)
    },
    [setActiveTab],
  )

  return {
    isMobile,
    desktopOpen,
    mobileOpen,
    setMobileOpen,
    toggle,
    openMobilePanel,
    activeTab,
    setActiveTab,
    expanded,
    toggleExpanded,
  }
}
