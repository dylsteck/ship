'use client'

import * as React from 'react'
import { CodeBlock } from './code-block'
import {
  parseGrepOutput,
  extractReadContent,
  getLanguageFromPath,
  isFileReadTool,
} from './tool-utils'

const FILE_ICON = (
  <svg className="w-3 h-3 shrink-0 text-muted-foreground/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

/** Render specialized output for grep/read tools, or null for generic fallback. */
export function renderToolOutput(
  name: string,
  input: Record<string, unknown> | undefined,
  output: unknown,
): React.ReactNode | null {
  const lower = name.toLowerCase()

  if (lower.includes('grep')) {
    const items = parseGrepOutput(output)
    if (items && items.length > 0) {
      return (
        <ul className="space-y-1 text-foreground/80 font-mono text-[11px]">
          {items.map(({ path, count }, i) => (
            <li key={i} className="flex items-center gap-2 pl-1">
              {FILE_ICON}
              <span className="truncate flex-1 min-w-0">{path}</span>
              {count != null && count > 0 && (
                <span className="text-muted-foreground/60 text-[10px] shrink-0">
                  {count === 1 ? '1 match' : `${count} matches`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )
    }
  }

  if (isFileReadTool(name, input, output) && input) {
    const path = String(input.file_path ?? input.path ?? input.filePath ?? '')
    if (path) {
      const fileContent = extractReadContent(output)
      const fileName = path.split('/').pop() ?? path
      const lang = getLanguageFromPath(fileName)

      return fileContent ? (
        <CodeBlock code={fileContent} language={lang} className="my-0" />
      ) : null
    }
  }

  return null
}
