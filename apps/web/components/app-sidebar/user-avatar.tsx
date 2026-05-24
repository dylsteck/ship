'use client'

import Image from 'next/image'
import type { User } from './types'

export function UserAvatar({ user }: { user: User }) {
  return (
    <span className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
      {user.avatarUrl ? (
        <Image src={user.avatarUrl} alt={user.username} width={24} height={24} className="w-6 h-6 object-cover" />
      ) : (
        <span>{user.username[0].toUpperCase()}</span>
      )}
    </span>
  )
}

export function UserDisplayName({ user }: { user: User }) {
  return (
    <span className="text-sm font-normal text-foreground/80 truncate group-data-[collapsible=icon]:hidden">
      {user.name || user.username}
    </span>
  )
}
