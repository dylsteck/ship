'use client'

import { SessionPanel } from './session-panel'
import type { SessionPanelProps } from './types'

export function OverviewTab(props: SessionPanelProps) {
  return <SessionPanel {...props} />
}
