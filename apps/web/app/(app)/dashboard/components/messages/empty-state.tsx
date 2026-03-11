'use client'

export function MessagesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
      <svg
        className="w-8 h-8 mb-3 text-muted-foreground/30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="text-sm">Send a message to start the conversation.</span>
    </div>
  )
}
