'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Settings01Icon,
  Logout01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@ship/ui/utils'
import {
  SidebarFooter as SidebarFooterPrimitive,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@ship/ui'
import { ClientOnly } from '../client-only'
import { ListFilterIcon } from './icons'
import type { User } from './types'

interface SidebarFooterSectionProps {
  user: User
  groupBy: 'none' | 'project' | 'date' | 'status'
  onGroupByChange: (value: 'none' | 'project' | 'date' | 'status') => void
  compact: boolean
  onCompactChange: (value: boolean) => void
}

function UserAvatar({ user }: { user: User }) {
  return (
    <span className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.username}
          width={24}
          height={24}
          className="w-6 h-6 object-cover"
        />
      ) : (
        <span>{user.username[0].toUpperCase()}</span>
      )}
    </span>
  )
}

function UserDisplayName({ user }: { user: User }) {
  return (
    <span className="text-sm font-normal text-foreground/80 truncate group-data-[collapsible=icon]:hidden">
      {user.name || user.username}
    </span>
  )
}

export function SidebarFooterSection({ user, groupBy, onGroupByChange, compact, onCompactChange }: SidebarFooterSectionProps) {
  const pathname = usePathname()
  const isSettingsActive = pathname === '/settings'
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <SidebarFooterPrimitive className="group-data-[collapsible=icon]:border-0 border-t border-sidebar-border">
      <div className="flex items-center justify-between">
        <ClientOnly
          fallback={
            <a
              href="/settings"
              className="flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer outline-none group-data-[collapsible=icon]:justify-center"
              aria-label="Open user menu"
            >
              <UserAvatar user={user} />
              <UserDisplayName user={user} />
            </a>
          }
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className={cn(
                    'flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer outline-none group-data-[collapsible=icon]:justify-center',
                    isSettingsActive && 'bg-sidebar-accent',
                  )}
                  aria-label="Open user menu"
                >
                  <UserAvatar user={user} />
                  <UserDisplayName user={user} />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <span>Appearance</span>
                  <span className="ml-auto text-muted-foreground capitalize">
                    {mounted && typeof theme === 'string' ? theme : 'System'}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={mounted && theme ? theme : 'system'}
                    onValueChange={(v) => setTheme(v)}
                  >
                    <DropdownMenuRadioItem value="system" className="cursor-pointer">
                      System
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="light" className="cursor-pointer">
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                      Dark
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => (window.location.href = '/settings')} className="cursor-pointer">
                <HugeiconsIcon icon={Settings01Icon} className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = '/api/auth/logout'
                }}
                className="cursor-pointer text-red-600 dark:text-red-400"
              >
                <HugeiconsIcon icon={Logout01Icon} className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ClientOnly>

        {/* Filter dropdown */}
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
      </div>
    </SidebarFooterPrimitive>
  )
}
