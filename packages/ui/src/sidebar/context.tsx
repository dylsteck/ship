'use client'

import * as React from 'react'

/** Sidebar provider context value. */
export type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

export const SidebarContext = React.createContext<SidebarContextProps | null>(null)

/** Access sidebar state from a descendant of {@link SidebarProvider}. */
export function useSidebar() {
  const context = React.use(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  return context
}
