import { normalizeMermaidCodeBlocks } from './markdown-mermaid'

const MARKDOWN_FENCE_PATTERN = /```([^\n`]*)\n([\s\S]*?)```/gi
const MARKDOWN_LANGUAGE_PATTERN = /^(?:markdown|md)\s*$/i
const MARKDOWN_LINE_PATTERN = /^\s*(?:#{1,6}\s+\S|[-*+]\s+\S|\d+[.)]\s+\S|\|[^|\n]+\||---+\s*$)/
const CODE_LINE_PATTERN =
  /^\s*(?:import\s|export\s|const\s|let\s|var\s|function\s|class\s|type\s|interface\s|enum\s|await\b|async\b|return\b|throw\b|new\s|console\.|if\s*\(|for\s*\(|while\s*\(|try\b|catch\b|switch\b|case\b|<\/?\w|[{[}\]])/
const SHELL_LINE_PATTERN =
  /^\s*(?:pnpm|npm|yarn|bun|git|cd|ls|cat|grep|rg|curl|npx|node|python|pip|deno|wrangler|docker|ssh|mkdir|rm|cp|mv|echo)\b/
const OUTPUT_LINE_PATTERN =
  /^\s*(?:(?:Error|Warning|TypeError|ReferenceError|SyntaxError|RangeError|Unhandled|Failed|Cannot)\b|[A-Z][A-Za-z]+Error:)/

/**
 * Normalizes agent-authored Markdown before rendering with Streamdown.
 */
export function normalizeChatMarkdown(markdown: string): string {
  return normalizeMermaidCodeBlocks(trimCodeFencePadding(unwrapRenderableMarkdownFences(markdown)))
}

/** Unwraps fenced Markdown documents that agents intended as prose, not source. */
export function unwrapRenderableMarkdownFences(markdown: string): string {
  return markdown.replace(MARKDOWN_FENCE_PATTERN, (match, info: string, source: string) => {
    const language = info.trim()
    const canUnwrap = MARKDOWN_LANGUAGE_PATTERN.test(language) || (!language && looksLikeMarkdownDocument(source))
    if (!canUnwrap) return match
    return source.trim()
  })
}

/** Trims accidental blank padding inside fenced code blocks. */
export function trimCodeFencePadding(markdown: string): string {
  return markdown.replace(MARKDOWN_FENCE_PATTERN, (match, info: string, source: string) => {
    const language = info.trim()
    const canUnwrap = MARKDOWN_LANGUAGE_PATTERN.test(language) || (!language && looksLikeMarkdownDocument(source))
    if (canUnwrap) return match

    return `\`\`\`${info}\n${trimFenceBlankPadding(source)}\n\`\`\``
  })
}

function looksLikeMarkdownDocument(source: string): boolean {
  const lines = source.split(/\r?\n/)
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0).length
  let markdownLines = 0
  let codeLines = 0
  let proseLines = 0

  for (const line of lines) {
    if (MARKDOWN_LINE_PATTERN.test(line) || /\*\*[^*\n]+/.test(line) || /`[^`\n]+`/.test(line)) {
      markdownLines += 1
    }
    if (CODE_LINE_PATTERN.test(line) || SHELL_LINE_PATTERN.test(line) || OUTPUT_LINE_PATTERN.test(line)) codeLines += 1
    if (looksLikeProseLine(line)) proseLines += 1
  }

  if (codeLines > 0) return false
  return markdownLines >= 2 || (nonEmptyLines <= 4 && proseLines > 0)
}

function trimFenceBlankPadding(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  while (lines.length > 0 && lines[0]?.trim() === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop()
  return lines.join('\n')
}

function looksLikeProseLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || SHELL_LINE_PATTERN.test(trimmed) || CODE_LINE_PATTERN.test(trimmed)) return false
  if (OUTPUT_LINE_PATTERN.test(trimmed) || /[{}[\];=<>]/.test(trimmed)) return false

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  return wordCount >= 8 && /[A-Za-z]/.test(trimmed) && /[.,;:!?—)]$/.test(trimmed)
}
