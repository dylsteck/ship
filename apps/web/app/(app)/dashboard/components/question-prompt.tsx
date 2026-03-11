'use client'

import * as React from 'react'
import { Button, Textarea, cn } from '@ship/ui'

interface QuestionPromptProps {
  id: string
  text: string
  status: 'pending' | 'replied' | 'rejected'
  onReply?: (answer: string) => void
  onSkip?: () => void
}

/** Parse question text into optional header + options (e.g. "Which would you like?\n\nA) Option 1\nB) Option 2") */
function parseQuestionText(text: string): { header?: string; options: string[]; hasOptions: boolean } {
  const trimmed = text.trim()
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { options: [], hasOptions: false }

  const optionsIdx = lines.findIndex((l) => /^[A-Z]\)\s/.test(l) || /^[A-Z]\.\s/.test(l))
  const hasOptions = optionsIdx >= 0
  if (hasOptions) {
    return {
      header: lines.slice(0, optionsIdx).join('\n'),
      options: lines.slice(optionsIdx),
      hasOptions: true,
    }
  }
  return { header: trimmed, options: [], hasOptions: false }
}

export function QuestionPrompt({
  id,
  text,
  status,
  onReply,
  onSkip,
}: QuestionPromptProps) {
  const [answer, setAnswer] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isPending = status === 'pending'
  const isReplied = status === 'replied'
  const isRejected = status === 'rejected'

  const { header, options, hasOptions } = parseQuestionText(text)

  const handleReply = async () => {
    if (!answer.trim() || !onReply || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onReply(answer.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    if (!onSkip || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSkip()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        isPending &&
          'border-blue-200/60 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20',
        isReplied &&
          'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20',
        isRejected &&
          'border-muted bg-muted/30 dark:border-muted/50 dark:bg-muted/20',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className={cn(
            'shrink-0 text-lg',
            isPending && 'text-blue-600 dark:text-blue-500',
            isReplied && 'text-emerald-600 dark:text-emerald-500',
            isRejected && 'text-muted-foreground',
          )}
        >
          {isPending ? '\u2753' : isReplied ? '\u2705' : '\u23ED\uFE0F'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground mb-0.5">
            {isPending ? 'Agent Question' : isReplied ? 'Answered' : 'Skipped'}
          </div>
          {header && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">
              {header}
            </div>
          )}
          {hasOptions && options.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {options.map((line, i) => (
                <div
                  key={i}
                  className="text-sm pl-2 border-l-2 border-muted-foreground/30 text-foreground/90"
                >
                  {line}
                </div>
              ))}
            </div>
          )}
          {isPending && (
            <div className="space-y-3">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && answer.trim() && onReply) {
                    e.preventDefault()
                    handleReply()
                  }
                }}
                placeholder="Type your answer..."
                className="min-h-[80px] resize-none text-sm"
                disabled={isSubmitting}
              />
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleReply}
                  disabled={!answer.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Sending…' : 'Reply'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Skip
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
