'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/components/providers/theme-context'
import { HugeiconsIcon } from '@hugeicons/react'
import { Settings01Icon, Logout01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@ship/ui/utils'
import {
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
import { UserAvatar, UserDisplayName } from './user-avatar'
import type { User } from './types'

export function SidebarUserMenu({ user, isSettingsActive }: { user: User; isSettingsActive: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
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
              <DropdownMenuRadioGroup value={mounted && theme ? theme : 'system'} onValueChange={(v) => setTheme(v)}>
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
  )
}
