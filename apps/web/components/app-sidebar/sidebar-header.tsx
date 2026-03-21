'use client'

import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Navigation03Icon,
} from '@hugeicons/core-free-icons'
import {
  SidebarHeader as SidebarHeaderPrimitive,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@ship/ui'

interface SidebarHeaderProps {
  onSearchOpen: () => void
  onNewChat?: () => void
}

export function SidebarHeaderSection({ onSearchOpen, onNewChat }: SidebarHeaderProps) {
  const router = useRouter()

  return (
    <>
      <SidebarHeaderPrimitive>
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
            <button
              type="button"
              onClick={onSearchOpen}
              className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              title="Search (⌘K)"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5" />
            </button>
          </div>
        </div>
      </SidebarHeaderPrimitive>

      {/* Top nav: New Agent */}
      <div className="px-2 pt-3 pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<button type="button" onClick={() => (onNewChat ? onNewChat() : router.push('/'))} />}
            >
              <HugeiconsIcon icon={Navigation03Icon} strokeWidth={2} className="size-4 text-muted-foreground/50 shrink-0" />
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                New Agent
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </>
  )
}
