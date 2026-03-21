/** Shared utilities for tool output parsing, formatting, and language detection */

// ============ Input Summary ============

export function getInputSummary(name: string, input: Record<string, unknown>): string | null {
  const lower = name.toLowerCase()
  const path = String(input.file_path ?? input.path ?? input.filePath ?? input.directory ?? input.cwd ?? '')
  const pattern = String(input.pattern ?? input.query ?? '')
  const start = input.start_line ?? input.startLine ?? input.start
  const end = input.end_line ?? input.endLine ?? input.end

  if (lower.includes('grep') && (pattern || path)) {
    const scope = path || 'codebase'
    return pattern ? `Grepped ${pattern} in ${scope}` : `Grepped in ${scope}`
  }

  if (lower.includes('read') && path) {
    if (start != null && end != null) return `Read ${path} L${start}-${end}`
    if (start != null) return `Read ${path} L${start}`
    return `Read ${path}`
  }

  if ((lower.includes('glob') || lower.includes('search')) && (pattern || input.glob || path)) {
    const q = String(input.glob ?? pattern)
    return q ? `Searched ${q} in ${path || 'codebase'}` : `Searched in ${path || 'codebase'}`
  }

  if ((lower.includes('web') || lower.includes('fetch')) && (pattern || input.url)) {
    const q = String(input.url ?? pattern)
    return q ? `Searched web ${q}` : 'Searched web'
  }

  if (path) {
    const segments = path.split('/')
    return segments.length > 3 ? '.../' + segments.slice(-3).join('/') : path
  }
  if (input.command) {
    const cmd = String(input.command)
    return cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd
  }
  if (pattern) return pattern.length > 60 ? pattern.slice(0, 57) + '...' : pattern
  if (input.glob) return String(input.glob)
  if (input.content) {
    const c = String(input.content)
    return c.length > 60 ? c.slice(0, 57) + '...' : c
  }
  if (input.description) {
    const d = String(input.description)
    return d.length > 60 ? d.slice(0, 57) + '...' : d
  }
  if (input.prompt) {
    const p = String(input.prompt)
    return p.length > 60 ? p.slice(0, 57) + '...' : p
  }
  const keys = Object.keys(input)
  if (keys.length === 1) {
    const val = String(input[keys[0]])
    return val.length > 60 ? val.slice(0, 57) + '...' : val
  }
  return null
}

// ============ Output Formatting ============

export function formatOutput(output: unknown): [string, boolean] {
  let text: string
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output)
      text = JSON.stringify(parsed, null, 2)
    } catch {
      text = output
    }
  } else {
    text = JSON.stringify(output, null, 2)
  }
  const MAX_LINES = 30
  const lines = text.split('\n')
  if (lines.length > MAX_LINES) {
    return [lines.slice(0, MAX_LINES).join('\n'), true]
  }
  return [text, false]
}

// ============ Grep Output Parsing ============

export function parseGrepOutput(output: unknown): Array<{ path: string; count?: number }> | null {
  if (!output) return null
  let data: unknown
  if (typeof output === 'string') {
    try {
      data = JSON.parse(output)
    } catch {
      const pathCounts = new Map<string, number>()
      for (const line of output.split('\n')) {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          const path = line.slice(0, colonIdx).trim()
          if (path && !path.startsWith('{')) pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1)
        }
      }
      return pathCounts.size > 0
        ? Array.from(pathCounts.entries()).map(([path, count]) => ({ path, count }))
        : null
    }
  } else {
    data = output
  }
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (typeof item === 'string') return { path: item }
        if (item && typeof item === 'object' && 'path' in item) return { path: String(item.path), count: (item as { count?: number }).count }
        if (item && typeof item === 'object' && 'file' in item) return { path: String((item as { file: string }).file) }
        return null
      })
      .filter((x): x is { path: string; count?: number } => x !== null)
  }
  if (data && typeof data === 'object' && 'matches' in data) {
    const matches = (data as { matches?: unknown[] }).matches
    if (Array.isArray(matches)) {
      const paths = new Map<string, number>()
      for (const m of matches) {
        const path = m && typeof m === 'object' && 'path' in m ? String((m as { path: string }).path) : null
        if (path) paths.set(path, (paths.get(path) ?? 0) + 1)
      }
      return Array.from(paths.entries()).map(([path, count]) => ({ path, count }))
    }
  }
  return null
}

// ============ Read Content Extraction ============

export function extractReadContent(output: unknown): string | null {
  if (output == null) return null
  let data: unknown = output
  if (typeof output === 'string') {
    try {
      data = JSON.parse(output)
    } catch {
      // Not JSON — might be raw file content or structured text
    }
  }

  if (data && typeof data === 'object' && 'output' in data) {
    const raw = String((data as { output: string }).output)
    return cleanReadContent(raw)
  }

  if (typeof output === 'string') {
    return cleanReadContent(output)
  }

  return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
}

function cleanReadContent(raw: string): string {
  let text = raw

  // Extract inner content from known XML wrapper tags
  // Priority: <content>...</content>, then <entries>...</entries>
  const contentMatch = text.match(/<content>([\s\S]*?)<\/content>/)
  if (contentMatch) {
    text = contentMatch[1]
  } else {
    const openContentMatch = text.match(/<content>([\s\S]*)$/)
    if (openContentMatch) {
      text = openContentMatch[1]
    } else {
      const entriesMatch = text.match(/<entries>([\s\S]*?)<\/entries>/)
      if (entriesMatch) {
        text = entriesMatch[1]
      } else {
        const openEntriesMatch = text.match(/<entries>([\s\S]*)$/)
        if (openEntriesMatch) {
          text = openEntriesMatch[1]
        }
      }
    }
  }

  // Strip XML frontmatter tags: <path>...</path>, <type>...</type>
  text = text.replace(/<path>[^<]*<\/path>\n?/g, '')
  text = text.replace(/<type>[^<]*<\/type>\n?/g, '')
  // Strip any remaining <entries> or </entries> tags
  text = text.replace(/<\/?entries>\n?/g, '')
  // Strip trailing metadata lines
  text = text.replace(/\n\(End of file[^\n]*\)\s*$/, '')
  text = text.replace(/\n\(truncated[^\n]*\)\s*$/, '')
  text = text.replace(/\n\(\d+ entries?\)\s*$/, '')
  // Trim leading/trailing whitespace
  text = text.replace(/^\n+/, '').replace(/\s+$/, '')
  return stripLineNumbers(text)
}

function stripLineNumbers(text: string): string {
  const lines = text.split('\n')
  // Match "cat -n" style: "     1\tcode" or Claude-style: "1: code", " 12: code"
  // Only strip if the majority of non-empty lines match the pattern
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length < 2) return text

  const catNPattern = /^\s+\d+\t/
  const colonPattern = /^\s*\d+: /

  const catNMatches = nonEmpty.filter((l) => catNPattern.test(l)).length
  const colonMatches = nonEmpty.filter((l) => colonPattern.test(l)).length

  if (catNMatches / nonEmpty.length > 0.8) {
    return lines.map((l) => l.replace(/^\s+\d+\t/, '')).join('\n')
  }
  if (colonMatches / nonEmpty.length > 0.8) {
    return lines.map((l) => l.replace(/^\s*\d+: /, '')).join('\n')
  }
  return text
}

// ============ Language Detection ============

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  tsx: 'tsx', jsx: 'jsx',
  py: 'python',
  json: 'json',
  html: 'html', htm: 'html',
  css: 'css', scss: 'css',
  sh: 'bash', zsh: 'bash',
  md: 'markdown', mdx: 'markdown',
  yml: 'yaml', yaml: 'yaml',
  sql: 'sql',
  rs: 'rust',
  go: 'go',
  toml: 'toml',
  diff: 'diff', patch: 'diff',
}

export function getLanguageFromPath(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANG[ext] ?? 'text'
}

// ============ File Read Detection ============

/** Detect if a tool is a file-read operation by its name, input, or output structure */
export function isFileReadTool(
  name: string,
  input?: Record<string, unknown>,
  output?: unknown,
): boolean {
  if (name.toLowerCase().includes('read')) return true
  const hasFilePath = input && (input.file_path || input.filePath || input.path)
  if (!hasFilePath) return false
  if (output == null) return false
  let data: unknown = output
  if (typeof output === 'string') {
    try { data = JSON.parse(output) } catch { return false }
  }
  if (data && typeof data === 'object' && 'output' in data && 'metadata' in data) return true
  return false
}
