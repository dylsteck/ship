'use client'

import { Editor } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

interface CodeViewerProps {
  filePath: string
  content: string
  language?: string
  readOnly?: boolean
}

export function CodeViewer({ filePath, content, language, readOnly = true }: CodeViewerProps) {
  const { theme } = useTheme()

  const detectedLanguage = useMemo(() => {
    if (language) return language

    // Auto-detect from file extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      sh: 'shell',
      bash: 'shell',
      sql: 'sql',
      graphql: 'graphql',
    }

    return languageMap[ext || ''] || 'plaintext'
  }, [filePath, language])

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  return (
    <div className="border rounded-lg overflow-hidden dark:border-gray-700">
      <div className="px-3 py-2 bg-gray-50 border-b text-xs font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        {filePath}
      </div>
      <Editor
        height="400px"
        language={detectedLanguage}
        value={content}
        theme={editorTheme}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
        loading={
          <div className="flex items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
            Loading editor...
          </div>
        }
      />
    </div>
  )
}
