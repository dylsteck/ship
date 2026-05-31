import { normalizeMermaidCodeBlocks } from './markdown-mermaid'

const MARKDOWN_FENCE_PATTERN = /```(?:markdown|md)([^\n`]*)\n([\s\S]*?)```/gi
const MARKDOWN_SHAPE_PATTERN = /(^|\n)\s*(?:#{1,6}\s+\S|[-*+]\s+\S|\d+[.)]\s+\S|\|[^|\n]+\|)|[`*_][\s\S]*?[`*_]/

/**
 * Normalizes agent-authored Markdown before rendering with Streamdown.
 */
export function normalizeChatMarkdown(markdown: string): string {
  return normalizeMermaidCodeBlocks(unwrapRenderableMarkdownFences(markdown))
}

/** Unwraps fenced Markdown documents that agents intended as prose, not source. */
export function unwrapRenderableMarkdownFences(markdown: string): string {
  return markdown.replace(MARKDOWN_FENCE_PATTERN, (match, _meta: string, source: string) => {
    if (!MARKDOWN_SHAPE_PATTERN.test(source)) return match
    return source.trim()
  })
}
