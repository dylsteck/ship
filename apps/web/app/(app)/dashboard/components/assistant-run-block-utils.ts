import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'

export function mergeAssistantText(contents: string[]): string {
  const merged: string[] = []
  for (const content of contents) {
    const normalized = normalizeText(content)
    if (!normalized) continue

    const containingIndex = merged.findIndex((existing) => normalizeText(existing).includes(normalized))
    if (containingIndex !== -1) continue

    const containedIndex = merged.findIndex((existing) => normalized.includes(normalizeText(existing)))
    if (containedIndex !== -1) {
      merged[containedIndex] = content
      continue
    }

    merged.push(content)
  }
  return merged.join('\n\n')
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function useAssistantRunAggregates(
  messages: UIMessage[],
  streamingMessageId: string | null,
) {
  const substantiveMessages = messages.filter(
    (m) => m.content || m.toolInvocations?.length || m.reasoning?.length || m.id === streamingMessageId,
  )

  const reasoningKey = substantiveMessages.map((m) => m.reasoning?.join()).join()
  const allReasoning = substantiveMessages.flatMap((m) => m.reasoning || [])

  const toolsKey = substantiveMessages
    .map((m) => m.toolInvocations?.map((t) => `${t.toolCallId}:${t.state}`).join())
    .join()
  const allToolsRaw = substantiveMessages.flatMap((m) => m.toolInvocations || [])
  const toolsByCallId = new Map<string, ToolInvocation>()
  const toolOrder: string[] = []
  for (const t of allToolsRaw) {
    if (!toolsByCallId.has(t.toolCallId)) toolOrder.push(t.toolCallId)
    toolsByCallId.set(t.toolCallId, t)
  }
  const allTools = toolOrder.map((id) => toolsByCallId.get(id)!)

  const allPlanItemsRaw = substantiveMessages.flatMap((m) => m.planItems || [])
  const planById = new Map(allPlanItemsRaw.map((p) => [p.id, p]))
  const allPlanItems = Array.from(planById.values())

  const startupStepsMsg = substantiveMessages.find((m) => m.startupSteps?.length)

  return {
    substantiveMessages,
    allReasoning,
    allTools,
    allPlanItems,
    startupStepsMsg,
    reasoningKey,
    toolsKey,
  }
}
