'use client'

import { cn } from '@ship/ui/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Settings01Icon } from '@hugeicons/core-free-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@ship/ui'
import { ClientOnly } from '../client-only'
import { ListFilterIcon } from './icons'

export function SidebarFilterMenu({
  groupBy,
  onGroupByChange,
  compact,
  onCompactChange,
  isSettingsActive,
}: {
  groupBy: 'none' | 'project' | 'date' | 'status'
  onGroupByChange: (value: 'none' | 'project' | 'date' | 'status') => void
  compact: boolean
  onCompactChange: (value: boolean) => void
  isSettingsActive: boolean
}) {
  return (
    <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
      <ClientOnly
        fallback={
          <button
            type="button"
            className="p-1 rounded text-muted-foreground/40 group-data-[collapsible=icon]:hidden"
            aria-label="Filter"
          >
            <ListFilterIcon className="size-3.5 text-muted-foreground" />
          </button>
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  'p-1 rounded transition-colors cursor-pointer group-data-[collapsible=icon]:hidden',
                  groupBy !== 'none'
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-sidebar-accent/50',
                )}
                title="Filter"
                aria-label="Filter and group options"
              >
                <ListFilterIcon className="size-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Group</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => onGroupByChange(v as typeof groupBy)}>
                <DropdownMenuRadioItem value="project" className="cursor-pointer">
                  Project
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date" className="cursor-pointer">
                  Date
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="status" className="cursor-pointer">
                  Status
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none" className="cursor-pointer">
                  None
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={compact}
              onCheckedChange={(v) => onCompactChange(v === true)}
              className="cursor-pointer"
            >
              Compact
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ClientOnly>
      <a
        href="/settings"
        className={cn(
          'p-1 rounded transition-colors cursor-pointer',
          isSettingsActive
            ? 'bg-sidebar-accent text-foreground'
            : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-sidebar-accent/50',
        )}
        title="Settings"
        aria-label="Settings"
      >
        <HugeiconsIcon icon={Settings01Icon} className="size-3.5 text-muted-foreground" />
      </a>
    </div>
  )
}
