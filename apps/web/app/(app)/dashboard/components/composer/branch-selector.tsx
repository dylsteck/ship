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

export function BranchSelector() {
  const { selectedBranch, onBranchSelect, branches, branchesLoading } = useComposer()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="group h-auto gap-1 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent! max-w-[140px]"
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
      <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
        {branchesLoading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
        ) : branches.length === 0 ? (
          <DropdownMenuRadioGroup value={selectedBranch} onValueChange={onBranchSelect}>
            <DropdownMenuRadioItem value={selectedBranch}>
              {selectedBranch}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        ) : (
          <DropdownMenuRadioGroup value={selectedBranch} onValueChange={onBranchSelect}>
            {branches.map((branch) => (
              <DropdownMenuRadioItem key={branch} value={branch}>
                {branch}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
