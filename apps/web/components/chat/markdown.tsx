'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@ship/ui'
import type { Components } from 'react-markdown'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const components: Components = {
    // Code blocks and inline code
    code({ className: codeClassName, children, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '')
      const isInline = !match && !codeClassName

      if (isInline) {
        return (
          <code
            className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            {...props}
          >
            {children}
          </code>
        )
      }

      // Code block (inside pre)
      return (
        <code className={cn('block font-mono text-sm', codeClassName)} {...props}>
          {children}
        </code>
      )
    },

    // Pre blocks (wrapping code blocks)
    pre({ children }) {
      return (
        <pre className="my-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-gray-100 dark:bg-gray-950">{children}</pre>
      )
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
      return <h1 className="mb-3 mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="mb-2 mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="mb-2 mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="mb-1 mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{children}</h4>
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-2 last:mb-0 text-gray-800 dark:text-gray-200">{children}</p>
    },

    // Lists
    ul({ children }) {
      return <ul className="mb-2 ml-4 list-disc space-y-1 text-gray-800 dark:text-gray-200">{children}</ul>
    },
    ol({ children }) {
      return <ol className="mb-2 ml-4 list-decimal space-y-1 text-gray-800 dark:text-gray-200">{children}</ol>
    },
    li({ children }) {
      return <li className="text-gray-800 dark:text-gray-200">{children}</li>
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="my-2 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
          {children}
        </blockquote>
      )
    },

    // Horizontal rules
    hr() {
      return <hr className="my-4 border-gray-200 dark:border-gray-700" />
    },

    // Tables
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">{children}</table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>
    },
    tr({ children }) {
      return <tr>{children}</tr>
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {children}
        </th>
      )
    },
    td({ children }) {
      return <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-800 dark:text-gray-200">{children}</td>
    },

    // Strong and emphasis
    strong({ children }) {
      return <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
    },
    em({ children }) {
      return <em className="italic">{children}</em>
    },

    // Strikethrough (GFM)
    del({ children }) {
      return <del className="text-gray-500 line-through dark:text-gray-400">{children}</del>
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
