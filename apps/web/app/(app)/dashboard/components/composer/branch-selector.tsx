'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { useComposer } from './composer-context'
import { useMemo } from 'react'

const COMMON_BRANCHES = ['main', 'master']

export function BranchSelector({ triggerClassName }: { triggerClassName?: string }) {
  const { selectedRepo, selectedBranch, onBranchSelect } = useComposer()

  const branches = useMemo(() => {
    const defaultBranch = selectedRepo?.defaultBranch
    const list = [...COMMON_BRANCHES]
    if (defaultBranch && !list.includes(defaultBranch)) {
      list.unshift(defaultBranch)
    }
    return list
  }, [selectedRepo?.defaultBranch])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={cn(
              'h-8 gap-1.5 px-2 sm:px-3 rounded-full text-sm max-w-[120px] sm:max-w-[140px] truncate',
              triggerClassName,
            )}
          >
            <span className="truncate">{selectedBranch}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="text-muted-foreground size-3.5 shrink-0"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuRadioGroup value={selectedBranch} onValueChange={onBranchSelect}>
          {branches.map((branch) => (
            <DropdownMenuRadioItem key={branch} value={branch}>
              {branch}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
