'use client'

import { usePathname } from 'next/navigation'
import { SidebarFooter as SidebarFooterPrimitive } from '@ship/ui'
import { SidebarUserMenu } from './sidebar-user-menu'
import { SidebarFilterMenu } from './sidebar-filter-menu'
import type { User } from './types'

interface SidebarFooterSectionProps {
  user: User
  groupBy: 'none' | 'project' | 'date' | 'status'
  onGroupByChange: (value: 'none' | 'project' | 'date' | 'status') => void
  compact: boolean
  onCompactChange: (value: boolean) => void
}

export function SidebarFooterSection({
  user,
  groupBy,
  onGroupByChange,
  compact,
  onCompactChange,
}: SidebarFooterSectionProps) {
  const pathname = usePathname()
  const isSettingsActive = pathname === '/settings'

  return (
    <SidebarFooterPrimitive className="group-data-[collapsible=icon]:border-0 border-t border-sidebar-border">
      <div className="flex items-center justify-between">
        <SidebarUserMenu user={user} isSettingsActive={isSettingsActive} />
        <SidebarFilterMenu
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          compact={compact}
          onCompactChange={onCompactChange}
          isSettingsActive={isSettingsActive}
        />
      </div>
    </SidebarFooterPrimitive>
  )
}
