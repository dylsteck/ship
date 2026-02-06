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

      if (isInline) {
        return (
          <code className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[13px] text-foreground/90">
            {children}
          </code>
        )
      }

      const language = match ? match[1] : 'text'
      const codeContent = String(children).replace(/\n$/, '')
      return <CodeBlock code={codeContent} language={language} />
    },

    // Pre blocks — handled by code component above
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
          className="text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary/60"
        >
          {children}
        </a>
      )
    },

    // Headings
    h1({ children }) {
      return <h1 className="mb-4 mt-6 first:mt-0 text-[1.35em] font-semibold leading-tight text-foreground">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="mb-3 mt-5 first:mt-0 text-[1.15em] font-semibold leading-tight text-foreground">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="mb-2 mt-4 first:mt-0 text-[1.05em] font-semibold leading-tight text-foreground">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="mb-2 mt-3 first:mt-0 text-sm font-semibold text-foreground">{children}</h4>
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-[1.7] text-foreground">{children}</p>
    },

    // Lists
    ul({ children }) {
      return <ul className="mb-3 ml-5 list-disc space-y-1.5 text-foreground [&>li]:pl-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="mb-3 ml-5 list-decimal space-y-1.5 text-foreground [&>li]:pl-1">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-[1.65] text-foreground marker:text-muted-foreground/50">{children}</li>
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="my-3 border-l-[3px] border-muted-foreground/20 pl-4 text-muted-foreground [&>p]:mb-1">
          {children}
        </blockquote>
      )
    },

    // Horizontal rules
    hr() {
      return <hr className="my-5 border-border/50" />
    },

    // Tables
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
          <table className="min-w-full divide-y divide-border/50">{children}</table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-muted/40">{children}</thead>
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-border/30">{children}</tbody>
    },
    tr({ children }) {
      return <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
          {children}
        </th>
      )
    },
    td({ children }) {
      return <td className="px-3 py-2 text-sm text-foreground">{children}</td>
    },

    // Emphasis
    strong({ children }) {
      return <strong className="font-semibold text-foreground">{children}</strong>
    },
    em({ children }) {
      return <em className="italic">{children}</em>
    },

    // Strikethrough
    del({ children }) {
      return <del className="text-muted-foreground line-through">{children}</del>
    },
  }

  return (
    <div className={cn('text-[14.5px] max-w-none break-words leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
