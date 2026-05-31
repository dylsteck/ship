import { normalizeMermaidCodeBlocks } from './markdown-mermaid'

const MARKDOWN_FENCE_PATTERN = /```([^\n`]*)\n([\s\S]*?)```/gi
const MARKDOWN_LANGUAGE_PATTERN = /^(?:markdown|md)\s*$/i
const MARKDOWN_LINE_PATTERN = /^\s*(?:#{1,6}\s+\S|[-*+]\s+\S|\d+[.)]\s+\S|\|[^|\n]+\||---+\s*$)/
const CODE_LINE_PATTERN = /^\s*(?:import\s|export\s|const\s|let\s|var\s|function\s|class\s|<\/?\w|[{[}\]])/

/**
 * Normalizes agent-authored Markdown before rendering with Streamdown.
 */
export function normalizeChatMarkdown(markdown: string): string {
  return normalizeMermaidCodeBlocks(unwrapRenderableMarkdownFences(markdown))
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

function looksLikeMarkdownDocument(source: string): boolean {
  let markdownLines = 0
  let codeLines = 0

  for (const line of source.split(/\r?\n/)) {
    if (MARKDOWN_LINE_PATTERN.test(line) || /\*\*[^*\n]+/.test(line) || /`[^`\n]+`/.test(line)) {
      markdownLines += 1
    }
    if (CODE_LINE_PATTERN.test(line)) codeLines += 1
  }

  return markdownLines >= 2 && codeLines === 0
}
