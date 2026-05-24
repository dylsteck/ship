/** Returns true for text/reasoning streaming deltas that are too noisy to store in eventsStore. */
export function isStreamingTextDelta(eventType: string, rawData: Record<string, unknown>): boolean {
  if (eventType !== 'message.part.updated') return false
  const props = rawData.properties as { part?: { type?: string } } | undefined
  const partType = props?.part?.type
  return partType === 'text' || partType === 'reasoning'
}

export function streamEventKey(sessionId: string, event: { type: string; [k: string]: unknown }): string | null {
  if (event.type === 'message.part.updated') {
    const properties = event.properties as { part?: Record<string, unknown>; delta?: unknown } | undefined
    const part = properties?.part
    if (!part) return null
    const messageId = String(part.messageID ?? part.messageId ?? '')
    // For tool parts include status so pending/running/completed updates aren't deduplicated
    const toolStatus = part.type === 'tool'
      ? String((part.state as Record<string, unknown> | undefined)?.status ?? '')
      : ''
    return [
      sessionId,
      event.type,
      messageId,
      String(part.id ?? ''),
      String(part.type ?? ''),
      toolStatus,
      typeof properties?.delta === 'string' ? properties.delta : '',
      typeof part.text === 'string' ? part.text : '',
    ].join('|')
  }

  if (event.type === 'status' || event.type === 'session.status') {
    return [
      sessionId,
      event.type,
      typeof event.status === 'string' ? event.status : '',
      typeof event.message === 'string' ? event.message : '',
    ].join('|')
  }

  if (event.type === 'session.error') {
    const properties = event.properties as { error?: { data?: { message?: string }; message?: string } } | undefined
    return [sessionId, event.type, properties?.error?.data?.message ?? properties?.error?.message ?? ''].join('|')
  }

  if (event.type === 'error') {
    return [sessionId, event.type, typeof event.error === 'string' ? event.error : ''].join('|')
  }

  if (event.type === 'done' || event.type === 'session.idle') return [sessionId, event.type].join('|')
  return null
}

export const SETTINGS_ACTION = { label: 'Open Settings', href: '/settings' } as const

export function actionForChatErrorPayload(payload: { category?: string }): { label: string; href: string } | undefined {
  if (payload.category === 'user-action') return SETTINGS_ACTION
  return undefined
}
