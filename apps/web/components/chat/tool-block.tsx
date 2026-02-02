'use client'

import { useState, useMemo } from 'react'
import { CodeViewer } from '../code/code-viewer'

interface ToolBlockProps {
  name: string
  input?: unknown
  output?: unknown
  state?: 'pending' | 'running' | 'complete' | 'error'
}

export function ToolBlock({ name, input, output, state = 'complete' }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false)

  const stateColors = {
    pending: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    complete: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  }

  // Detect file operations and extract file info
  const fileInfo = useMemo(() => {
    const fileOperationNames = ['write_file', 'edit_file', 'create_file', 'writeFile', 'editFile', 'createFile']
    const isFileOperation = fileOperationNames.some((op) => name.toLowerCase().includes(op.toLowerCase()))

    if (!isFileOperation) return null

    // Try to extract file path and content from input
    let filePath: string | undefined
    let content: string | undefined

    if (input && typeof input === 'object') {
      const inputObj = input as Record<string, unknown>
      // Common patterns: { path, content }, { filePath, content }, { file, content }
      filePath =
        (inputObj.path as string) ||
        (inputObj.filePath as string) ||
        (inputObj.file as string) ||
        (inputObj.filename as string)
      content =
        (inputObj.content as string) ||
        (inputObj.code as string) ||
        (inputObj.text as string) ||
        (inputObj.data as string)
    }

    // If not in input, try output
    if (!content && output) {
      if (typeof output === 'string') {
        content = output
      } else if (typeof output === 'object') {
        const outputObj = output as Record<string, unknown>
        content =
          (outputObj.content as string) ||
          (outputObj.code as string) ||
          (outputObj.text as string) ||
          (outputObj.data as string)
      }
    }

    if (filePath && content) {
      return { filePath, content }
    }

    return null
  }, [name, input, output])

  return (
    <div className="mt-2 overflow-hidden rounded-lg border dark:border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center justify-between px-3 py-2 ${stateColors[state]}`}
      >
        <span className="font-mono text-sm">{name}</span>
        <span className="text-xs">
          {state === 'running' && 'Running...'}
          {state === 'pending' && 'Pending'}
          {state === 'complete' && (expanded ? 'Collapse' : 'Expand')}
          {state === 'error' && 'Error'}
        </span>
      </button>

      {expanded && (
        <div className="bg-gray-50 dark:bg-gray-900">
          {/* Show code viewer for file operations */}
          {fileInfo && (
            <div className="p-3">
              <CodeViewer filePath={fileInfo.filePath} content={fileInfo.content} readOnly={true} />
            </div>
          )}

          {/* Show raw input/output if not a file operation or if file info extraction failed */}
          {(!fileInfo || fileInfo === null) && (
            <div className="p-3 font-mono text-sm">
              {input !== undefined && (
                <div className="mb-2">
                  <div className="mb-1 text-xs text-gray-500">Input:</div>
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(input, null, 2)}</pre>
                </div>
              )}
              {output !== undefined && (
                <div>
                  <div className="mb-1 text-xs text-gray-500">Output:</div>
                  <pre className="whitespace-pre-wrap text-xs">
                    {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
