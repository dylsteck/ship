import type { ToolState } from './message-parts'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeCommandValue(value: unknown): string | undefined {
  const direct = asTrimmedString(value)
  if (direct) {
    return direct
  }
  if (!Array.isArray(value)) {
    return undefined
  }
  const parts = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== undefined)
  return parts.length > 0 ? parts.join(' ') : undefined
}

function stripTrailingExitCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }
  const match = /^(?<output>[\s\S]*?)(?:\s*<exited with exit code \d+>)\s*$/iu.exec(trimmed)
  const output = match?.groups?.output?.trim() ?? trimmed
  return output.length > 0 ? output : undefined
}

function extractCommandFromTitle(title: string | undefined): string | undefined {
  if (!title) {
    return undefined
  }
  const backtickMatch = /`([^`]+)`/u.exec(title)
  return backtickMatch?.[1]?.trim() || undefined
}

function extractToolCommand(
  data: Record<string, unknown> | undefined,
  title: string | undefined,
): string | undefined {
  const item = asRecord(data?.item)
  const itemInput = asRecord(item?.input)
  const itemResult = asRecord(item?.result)
  const rawInput = asRecord(data?.rawInput)
  const candidates = [
    normalizeCommandValue(item?.command),
    normalizeCommandValue(itemInput?.command),
    normalizeCommandValue(itemResult?.command),
    normalizeCommandValue(data?.command),
    normalizeCommandValue(rawInput?.command),
  ]
  const direct = candidates.find((candidate) => candidate !== undefined)
  if (direct) {
    return direct
  }
  const executable = asTrimmedString(rawInput?.executable)
  const args = normalizeCommandValue(rawInput?.args)
  if (executable && args) {
    return `${executable} ${args}`
  }
  if (executable) {
    return executable
  }
  return extractCommandFromTitle(title)
}

function maybePathLike(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.startsWith('.') ||
    /\.(?:[a-z0-9]{1,12})$/iu.test(value)
  ) {
    return value
  }
  return undefined
}

function collectPaths(value: unknown, paths: string[], seen: Set<string>, depth: number): void {
  if (depth > 4 || paths.length >= 8) {
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectPaths(entry, paths, seen, depth + 1)
      if (paths.length >= 8) {
        return
      }
    }
    return
  }
  const record = asRecord(value)
  if (!record) {
    return
  }
  for (const key of ['path', 'filePath', 'relativePath', 'filename', 'newPath', 'oldPath']) {
    const candidate = maybePathLike(asTrimmedString(record[key]))
    if (!candidate || seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    paths.push(candidate)
    if (paths.length >= 8) {
      return
    }
  }
  for (const nestedKey of ['locations', 'item', 'input', 'result', 'rawInput', 'data', 'changes']) {
    if (!(nestedKey in record)) {
      continue
    }
    collectPaths(record[nestedKey], paths, seen, depth + 1)
    if (paths.length >= 8) {
      return
    }
  }
}

function extractPrimaryPath(data: Record<string, unknown> | undefined): string | undefined {
  const paths: string[] = []
  collectPaths(data, paths, new Set<string>(), 0)
  return paths[0]
}

function normalizeEquivalentValue(value: string | undefined): string | undefined {
  const trimmed = asTrimmedString(value)
  if (!trimmed) {
    return undefined
  }
  return trimmed
    .replace(/\s+/gu, ' ')
    .replace(/\s+(?:complete|completed|started)\s*$/iu, '')
    .trim()
}

function isEquivalent(left: string | undefined, right: string | undefined): boolean {
  const normalizedLeft = normalizeEquivalentValue(left)?.toLowerCase()
  const normalizedRight = normalizeEquivalentValue(right)?.toLowerCase()
  return normalizedLeft !== undefined && normalizedLeft === normalizedRight
}

type ToolAction = 'command' | 'read' | 'file_change' | 'search' | 'other'

function classifyToolAction(input: {
  toolName: string
  title?: string
  data?: Record<string, unknown>
}): ToolAction {
  const toolName = input.toolName.toLowerCase()
  const kind = asTrimmedString(input.data?.kind)?.toLowerCase()
  const title = asTrimmedString(input.title)?.toLowerCase()

  if (
    toolName.includes('bash') ||
    toolName.includes('shell') ||
    toolName.includes('terminal') ||
    toolName.includes('command') ||
    kind === 'execute' ||
    title === 'terminal'
  ) {
    return 'command'
  }
  if (toolName.includes('read') || kind === 'read' || title === 'read file') {
    return 'read'
  }
  if (
    toolName.includes('write') ||
    toolName.includes('edit') ||
    toolName.includes('patch') ||
    kind === 'edit' ||
    kind === 'move' ||
    kind === 'delete' ||
    kind === 'write'
  ) {
    return 'file_change'
  }
  if (
    toolName.includes('grep') ||
    toolName.includes('glob') ||
    toolName.includes('search') ||
    kind === 'search' ||
    title === 'find' ||
    title === 'grep'
  ) {
    return 'search'
  }
  return 'other'
}

export interface ToolPresentation {
  summary: string
  detail?: string
}

/**
 * Derive a compact summary/detail pair for tool UI from tool name and state.
 *
 * Ports presentation heuristics from t3code `toolActivity.ts`, adapted for
 * Ship {@link ToolState} shapes on SSE tool parts.
 *
 * @param toolName - Tool identifier from the tool part
 * @param state - Live tool state including input, output, and metadata
 */
export function deriveToolPresentation(toolName: string, state: ToolState): ToolPresentation {
  const title = asTrimmedString(state.title)
  const detail = stripTrailingExitCode(asTrimmedString(state.output ?? state.raw))
  const fallbackSummary = asTrimmedString(toolName) ?? 'Tool'
  const metadata = asRecord(state.metadata)
  const data: Record<string, unknown> = {
    rawInput: state.input,
    ...(metadata ?? {}),
  }
  const command = extractToolCommand(data, title)
  const primaryPath = extractPrimaryPath(data)
  const action = classifyToolAction({
    toolName,
    title,
    data,
  })

  if (action === 'command') {
    return {
      summary: 'Ran command',
      ...(command ? { detail: command } : {}),
    }
  }

  if (action === 'read') {
    if (primaryPath) {
      return {
        summary: 'Read file',
        detail: primaryPath,
      }
    }
    return {
      summary: 'Read file',
    }
  }

  if (action === 'file_change') {
    return {
      summary: 'Changed files',
      ...(primaryPath ? { detail: primaryPath } : {}),
    }
  }

  if (action === 'search') {
    const rawInput = asRecord(data.rawInput)
    const query =
      asTrimmedString(rawInput?.query) ??
      asTrimmedString(rawInput?.pattern) ??
      asTrimmedString(rawInput?.searchTerm)
    return {
      summary: 'Searched files',
      ...(query ? { detail: query } : {}),
    }
  }

  if (detail && !isEquivalent(detail, title) && !isEquivalent(detail, fallbackSummary)) {
    return {
      summary: title ?? fallbackSummary,
      detail,
    }
  }

  return {
    summary: title ?? fallbackSummary,
  }
}
