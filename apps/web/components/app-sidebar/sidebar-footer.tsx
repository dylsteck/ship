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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@ship/ui'
import { ClientOnly } from '../client-only'
import type { User } from './types'

interface SidebarFooterSectionProps {
  user: User
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

export function SidebarFooterSection({ user }: SidebarFooterSectionProps) {
  const pathname = usePathname()
  const isSettingsActive = pathname === '/settings'
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <SidebarFooterPrimitive className="group-data-[collapsible=icon]:border-0 border-t border-sidebar-border">
      <ClientOnly
        fallback={
          <a
            href="/settings"
            className="w-full flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer outline-none group-data-[collapsible=icon]:justify-center"
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
                  'w-full flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer outline-none group-data-[collapsible=icon]:justify-center',
                  isSettingsActive && 'bg-sidebar-accent',
                )}
                aria-label="Open user menu"
              >
                <UserAvatar user={user} />
                <UserDisplayName user={user} />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
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
    </SidebarFooterPrimitive>
  )
}
