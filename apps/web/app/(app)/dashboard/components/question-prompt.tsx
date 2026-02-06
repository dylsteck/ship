'use client'

import { useState } from 'react'
import { Button } from '@ship/ui'

interface QuestionPromptProps {
  id: string
  text: string
  status: 'pending' | 'replied' | 'rejected'
  onReply?: (answer: string) => void
  onSkip?: () => void
}

export function QuestionPrompt({
  id,
  text,
  status,
  onReply,
  onSkip,
}: QuestionPromptProps) {
  const [answer, setAnswer] = useState('')
  const isPending = status === 'pending'
  const isReplied = status === 'replied'
  const isRejected = status === 'rejected'

  return (
    <div
      className={`border rounded-lg p-4 ${
        isPending
          ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20'
          : isReplied
            ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
            : 'border-gray-500/50 bg-gray-50 dark:bg-gray-950/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={isPending ? 'text-blue-600' : isReplied ? 'text-green-600' : 'text-gray-600'}>
          {isPending ? '\u2753' : isReplied ? '\u2705' : '\u23ED\uFE0F'}
        </span>
        <div className="flex-1">
          <div className="font-medium text-foreground mb-2">{text}</div>
          {isPending && (
            <div className="space-y-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && answer.trim() && onReply) {
                    onReply(answer.trim())
                  }
                }}
                placeholder="Type your answer..."
                className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (answer.trim() && onReply) onReply(answer.trim())
                  }}
                  disabled={!answer.trim()}
                >
                  Reply
                </Button>
                <Button variant="outline" size="sm" onClick={onSkip}>
                  Skip
                </Button>
              </div>
            </div>
          )}
          {!isPending && (
            <div className="text-sm text-muted-foreground">
              {isReplied ? 'Answered' : 'Skipped'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
