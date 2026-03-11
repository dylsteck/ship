'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Add01Icon,
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
          <Link
            href="/"
            className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden hover:opacity-80 transition-opacity"
          >
            Ship
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSearchOpen}
              className="size-5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
              title="Search (⌘K)"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
            </button>
            <SidebarTrigger className="size-5 cursor-pointer text-muted-foreground hover:text-foreground" />
          </div>
        </div>
      </SidebarHeaderPrimitive>

      {/* Top nav: New Chat + feature items */}
      <div className="px-2 pt-3 pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<button type="button" onClick={() => (onNewChat ? onNewChat() : router.push('/'))} />}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 text-muted-foreground/50 shrink-0" />
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                New chat
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<button type="button" />}>
              <svg className="size-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Automations
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<button type="button" />}>
              <svg className="size-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <path d="M12 8v3M7.5 17.2 10.5 11M16.5 17.2 13.5 11" />
              </svg>
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Swarm
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<button type="button" />}>
              <svg className="size-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span className="text-sm font-normal text-foreground/75 group-data-[collapsible=icon]:hidden">
                Dashboard
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </>
  )
}
