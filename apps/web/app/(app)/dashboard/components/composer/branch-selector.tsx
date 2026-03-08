'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { useComposer } from './composer-context'
import { useMemo } from 'react'

const COMMON_BRANCHES = ['main', 'master']

export function BranchSelector() {
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
            className="group h-auto gap-1 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent max-w-[140px]"
          >
            <span className="truncate text-sm">{selectedBranch}</span>
            <svg
              className="h-3 w-3 shrink-0 opacity-40 transition-opacity duration-150 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
            </svg>
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
