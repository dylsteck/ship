'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn, CodeBlock } from '@ship/ui'
import type { Components } from 'react-markdown'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const components: Components = {
    // Code blocks and inline code
    code({ className: codeClassName, children }) {
      const match = /language-(\w+)/.exec(codeClassName || '')
      const isInline = !match && !codeClassName
      const language = match ? match[1] : 'text'

      if (isInline) {
        return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
      }

      // Code block - use AI Elements CodeBlock
      const codeContent = String(children).replace(/\n$/, '')
      return <CodeBlock code={codeContent} language={language} />
    },

    // Pre blocks - handled by code component above, just return children
    pre({ children }) {
      return <>{children}</>
    },

    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline decoration-blue-500/30 underline-offset-2 transition-colors hover:text-blue-400 hover:decoration-blue-400/50 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:text-blue-300"
        >
          {children}
        </a>
      )
    },

    // Headings
    h1({ children }) {
      return <h1 className="mb-3 mt-4 text-xl font-semibold text-foreground">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="mb-2 mt-3 text-lg font-semibold text-foreground">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="mb-2 mt-3 text-base font-semibold text-foreground">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="mb-1 mt-2 text-sm font-semibold text-foreground">{children}</h4>
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-2 last:mb-0 text-foreground">{children}</p>
    },

    // Lists
    ul({ children }) {
      return <ul className="mb-2 ml-4 list-disc space-y-1 text-foreground">{children}</ul>
    },
    ol({ children }) {
      return <ol className="mb-2 ml-4 list-decimal space-y-1 text-foreground">{children}</ol>
    },
    li({ children }) {
      return <li className="text-foreground">{children}</li>
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="my-2 border-l-4 border-border pl-4 italic text-muted-foreground">
          {children}
        </blockquote>
      )
    },

    // Horizontal rules
    hr() {
      return <hr className="my-4 border-border" />
    },

    // Tables
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-border">{children}</table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-muted">{children}</thead>
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-border">{children}</tbody>
    },
    tr({ children }) {
      return <tr>{children}</tr>
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {children}
        </th>
      )
    },
    td({ children }) {
      return <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground">{children}</td>
    },

    // Strong and emphasis
    strong({ children }) {
      return <strong className="font-semibold text-foreground">{children}</strong>
    },
    em({ children }) {
      return <em className="italic">{children}</em>
    },

    // Strikethrough (GFM)
    del({ children }) {
      return <del className="text-muted-foreground line-through">{children}</del>
    },
  }

  return (
    <div className={cn('prose-sm max-w-none break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
