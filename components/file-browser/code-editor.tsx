'use client'

import { useEffect, useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'

interface CodeEditorProps {
  value: string
  language?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  path?: string
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    vue: 'vue',
    svelte: 'svelte',
    xml: 'xml',
    svg: 'xml',
  }
  return languageMap[ext || ''] || 'plaintext'
}

export function CodeEditor({ value, language, onChange, readOnly = false, path = '' }: CodeEditorProps) {
  const { resolvedTheme } = useTheme()
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const detectedLanguage = language || getLanguageFromPath(path)

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly,
      })
    }
  }, [readOnly])

  return (
    <Editor
      height="100%"
      language={detectedLanguage}
      value={value}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
      onChange={(val) => onChange?.(val || '')}
      onMount={handleEditorDidMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'var(--font-geist-mono), monospace',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 12 },
      }}
    />
  )
}
