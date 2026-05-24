export function TaskStatusIcon({
  isInProgress,
  isCompleted,
  isCancelled,
}: {
  isInProgress: boolean
  isCompleted: boolean
  isCancelled: boolean
}) {
  if (isInProgress) {
    return (
      <span className="relative flex h-3 w-3 shrink-0 mt-0.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/30 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 border-[1.5px] border-primary/30 border-t-primary animate-spin" />
      </span>
    )
  }
  if (isCompleted) {
    return (
      <span className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40 shrink-0 mt-0.5 flex items-center justify-center">
        <svg className="w-2 h-2 text-green-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (isCancelled) {
    return <span className="w-3 h-3 rounded-full bg-red-500/10 border border-red-500/30 shrink-0 mt-0.5" />
  }
  return <span className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
}
