'use client'

import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons'
import {
  SidebarHeader as SidebarHeaderPrimitive,
  SidebarTrigger,
} from '@ship/ui'

interface SidebarHeaderProps {
  onSearchOpen: () => void
  onNewChat?: () => void
}

export function SidebarHeaderSection({ onSearchOpen, onNewChat }: SidebarHeaderProps) {
  const router = useRouter()

  return (
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
          <button
            type="button"
            onClick={() => (onNewChat ? onNewChat() : router.push('/'))}
            className="size-3.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            title="New Agent"
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" />
          </button>
        </div>
      </div>
    </SidebarHeaderPrimitive>
  )
}
