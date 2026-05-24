/** Props for the {@link Tool} component. */
export interface ToolProps {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: unknown
  duration?: number
  className?: string
  onClick?: () => void
  isSubagent?: boolean
  /** When true, renders as flat list item (no bg/border) for use inside ThinkingBlock */
  compact?: boolean
  /**
   * `stacked`: name/summary on first row, status/duration on second (narrow screens / agent activity).
   */
  layout?: 'default' | 'stacked'
}
