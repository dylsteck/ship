'use client'

import { useState } from 'react'
import { FileTree, FileNode } from './file-tree'
import { CodeEditor } from './code-editor'
import { DiffViewer } from './diff-viewer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code, GitCompare, FolderTree, List } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'tree' | 'list' | 'editor' | 'diff'

interface FileBrowserProps {
  files: FileNode[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  fileContent?: string
  originalContent?: string
  onContentChange?: (content: string) => void
  readOnly?: boolean
  className?: string
}

export function FileBrowser({
  files,
  selectedPath,
  onSelectFile,
  fileContent = '',
  originalContent,
  onContentChange,
  readOnly = true,
  className,
}: FileBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [sidebarWidth, setSidebarWidth] = useState(250)

  const hasDiff = originalContent !== undefined && originalContent !== fileContent

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="h-8">
            <TabsTrigger value="tree" className="h-7 px-2">
              <FolderTree className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list" className="h-7 px-2">
              <List className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="editor" className="h-7 px-2">
              <Code className="h-4 w-4" />
            </TabsTrigger>
            {hasDiff && (
              <TabsTrigger value="diff" className="h-7 px-2">
                <GitCompare className="h-4 w-4" />
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        {selectedPath && (
          <span className="text-sm text-muted-foreground truncate max-w-[300px]">{selectedPath}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar (Tree/List view) */}
        {(viewMode === 'tree' || viewMode === 'list') && (
          <div
            className="border-r overflow-auto"
            style={{ width: sidebarWidth, minWidth: 150, maxWidth: 400 }}
          >
            {viewMode === 'tree' ? (
              <FileTree files={files} selectedPath={selectedPath} onSelectFile={onSelectFile} />
            ) : (
              <FileListView files={files} selectedPath={selectedPath} onSelectFile={onSelectFile} />
            )}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {viewMode === 'diff' && hasDiff ? (
            <DiffViewer
              oldContent={originalContent || ''}
              newContent={fileContent}
              oldFileName={`${selectedPath} (original)`}
              newFileName={`${selectedPath} (modified)`}
            />
          ) : selectedPath ? (
            <CodeEditor
              value={fileContent}
              path={selectedPath}
              onChange={onContentChange}
              readOnly={readOnly}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Simple flat list view
function FileListView({
  files,
  selectedPath,
  onSelectFile,
}: {
  files: FileNode[]
  selectedPath?: string
  onSelectFile: (path: string) => void
}) {
  const flatFiles = flattenFiles(files)

  return (
    <div className="py-2">
      {flatFiles.map((file) => (
        <div
          key={file.path}
          className={cn(
            'px-3 py-1.5 cursor-pointer hover:bg-accent text-sm truncate',
            selectedPath === file.path && 'bg-accent'
          )}
          onClick={() => onSelectFile(file.path)}
        >
          {file.path}
        </div>
      ))}
    </div>
  )
}

function flattenFiles(files: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const file of files) {
    if (file.type === 'file') {
      result.push(file)
    }
    if (file.children) {
      result.push(...flattenFiles(file.children))
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path))
}

export { FileTree, CodeEditor, DiffViewer }
export type { FileNode }
