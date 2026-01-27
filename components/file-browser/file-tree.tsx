'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileTreeProps {
  files: FileNode[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  expandedPaths?: Set<string>
  onToggleExpand?: (path: string) => void
}

interface FileTreeItemProps {
  node: FileNode
  depth: number
  selectedPath?: string
  onSelectFile: (path: string) => void
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
}

function FileTreeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
  expandedPaths,
  onToggleExpand,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const isDirectory = node.type === 'directory'

  const handleClick = () => {
    if (isDirectory) {
      onToggleExpand(node.path)
    } else {
      onSelectFile(node.path)
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent rounded-sm text-sm',
          isSelected && 'bg-accent'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-blue-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({
  files,
  selectedPath,
  onSelectFile,
  expandedPaths: controlledExpandedPaths,
  onToggleExpand: controlledOnToggleExpand,
}: FileTreeProps) {
  const [internalExpandedPaths, setInternalExpandedPaths] = useState<Set<string>>(new Set())

  const expandedPaths = controlledExpandedPaths ?? internalExpandedPaths
  const onToggleExpand =
    controlledOnToggleExpand ??
    ((path: string) => {
      setInternalExpandedPaths((prev) => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        return next
      })
    })

  return (
    <div className="py-2">
      {files.map((file) => (
        <FileTreeItem
          key={file.path}
          node={file}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          expandedPaths={expandedPaths}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  )
}
