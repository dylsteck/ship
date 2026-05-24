export function BranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M6 7.5v3A4.5 4.5 0 0 0 10.5 15H18" />
      <path d="M18 7.5V19" />
    </svg>
  )
}

export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5h6l2 2h9v8.5a2 2 0 0 1-2 2h-15z" />
      <path d="M3.5 7.5v-2h5.3l2 2" />
    </svg>
  )
}
