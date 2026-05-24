'use client'

import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { cn } from '../utils'
import { ToolPanel, ToolTrigger } from './tool-parts'
import type { ToolProps } from './tool-types'
import {
  formatDurationLabel,
  formatOutput,
  getFullOutputText,
  getInputSummary,
  isFileReadTool,
} from './tool-utils'

export type { ToolProps } from './tool-types'

/** Tool invocation card with collapsible input/output details. */
export function Tool({
  name,
  status,
  input,
  output,
  duration,
  className,
  onClick,
  isSubagent,
  compact = false,
  layout = 'default',
}: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [showFullOutput, setShowFullOutput] = React.useState(false)

  const isReadTool = isFileReadTool(name, input, output)
  const inputSummary = input && Object.keys(input).length > 0 ? getInputSummary(name, input) : null
  const hasOutput = output !== undefined && (typeof output !== 'string' || output.length > 0)
  const hasDetails = (input && Object.keys(input).length > 0) || hasOutput

  const [truncatedOutput, isOutputTruncated] = output !== undefined ? formatOutput(output) : ['', false]
  const fullOutputText = output !== undefined ? getFullOutputText(output) : ''
  const durationLabel = formatDurationLabel(duration)

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={isSubagent ? undefined : setIsOpen}>
      <div
        className={cn('group/tool', isSubagent && 'cursor-pointer', compact && 'border-none', className)}
        onClick={isSubagent ? onClick : undefined}
      >
        <ToolTrigger
          name={name}
          status={status}
          inputSummary={inputSummary}
          durationLabel={durationLabel}
          layout={layout}
          compact={compact}
          isSubagent={isSubagent}
          hasDetails={hasDetails}
          isOpen={isOpen}
        />
        {hasDetails && !isSubagent && (
          <ToolPanel
            name={name}
            input={input}
            output={output}
            compact={compact}
            isReadTool={isReadTool}
            hasOutput={hasOutput}
            showFullOutput={showFullOutput}
            onToggleFullOutput={() => setShowFullOutput((prev) => !prev)}
            truncatedOutput={truncatedOutput}
            isOutputTruncated={isOutputTruncated}
            fullOutputText={fullOutputText}
          />
        )}
      </div>
    </CollapsiblePrimitive.Root>
  )
}
