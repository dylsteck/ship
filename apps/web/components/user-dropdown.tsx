'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { Settings01Icon, Logout01Icon } from '@hugeicons/core-free-icons'
import { ClientOnly } from './client-only'

interface UserDropdownProps {
  user?: { username: string; avatarUrl: string | null }
}

function UserAvatar({ user }: UserDropdownProps) {
  return user?.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={user.username}
      width={20}
      height={20}
      className="size-5 rounded-full object-cover hover:opacity-80 transition-opacity"
    />
  ) : (
    <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium hover:opacity-80 transition-opacity">
      {user?.username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

export function UserDropdown({ user }: UserDropdownProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <ClientOnly fallback={<UserAvatar user={user} />}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="focus:outline-none rounded-full cursor-pointer shrink-0">
              <UserAvatar user={user} />
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
            <HugeiconsIcon icon={Settings01Icon} className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => (window.location.href = '/api/auth/logout')}
            className="cursor-pointer text-red-600 dark:text-red-400"
          >
            <HugeiconsIcon icon={Logout01Icon} className="mr-2 size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ClientOnly>
  )
}
