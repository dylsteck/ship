'use client'

import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { cn } from '../utils'
import { SubagentToolPanel, SubagentToolTrigger, type SubagentToolProps } from './subagent-tool-parts'
import { formatAgentType } from './subagent-tool-icons'
import { formatDurationLabel } from './tool-utils'

export type { SubagentToolProps } from './subagent-tool-parts'

/** Collapsible card for a sub-agent tool invocation with child tools and navigation. */
export function SubagentTool({
  toolCallId,
  agentType,
  description,
  status,
  duration,
  result,
  childTools,
  onNavigate,
  className,
}: SubagentToolProps) {
  const [isOpen, setIsOpen] = React.useState(status === 'in_progress')

  React.useEffect(() => {
    if (status === 'in_progress') {
      setIsOpen(true)
    }
  }, [status])

  const durationLabel = formatDurationLabel(duration)
  const formattedType = formatAgentType(agentType)
  const hasExpandContent = (childTools && childTools.length > 0) || !!result

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('group/tool', className)}>
        <SubagentToolTrigger
          toolCallId={toolCallId}
          formattedType={formattedType}
          description={description}
          status={status}
          durationLabel={durationLabel}
          hasExpandContent={hasExpandContent}
          isOpen={isOpen}
          onNavigate={onNavigate}
        />
        {hasExpandContent && (
          <SubagentToolPanel
            toolCallId={toolCallId}
            childTools={childTools}
            result={result}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </CollapsiblePrimitive.Root>
  )
}
