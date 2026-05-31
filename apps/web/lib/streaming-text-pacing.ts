/** Default delay between paced streaming text reveals. */
export const STREAMING_TEXT_PACE_MS = 24

const STREAMING_TEXT_SNAP_PATTERN = /[\s.,!?;:)\]]/

/**
 * Returns the number of characters to reveal for the next streaming text tick.
 *
 * @param remainingLength - Characters not yet shown.
 */
export function getPacedTextStepSize(remainingLength: number): number {
  if (remainingLength <= 12) return 2
  if (remainingLength <= 48) return 4
  if (remainingLength <= 96) return 8
  return Math.min(24, Math.ceil(remainingLength / 8))
}

/**
 * Finds the next visible text length, snapping forward to nearby word boundaries.
 *
 * @param text - Full latest text from the stream.
 * @param currentLength - Number of characters currently visible.
 */
export function getNextPacedTextLength(text: string, currentLength: number): number {
  const remainingLength = text.length - currentLength
  const end = Math.min(text.length, currentLength + getPacedTextStepSize(remainingLength))
  const max = Math.min(text.length, end + 8)

  for (let i = end; i < max; i++) {
    if (STREAMING_TEXT_SNAP_PATTERN.test(text[i] ?? '')) return i + 1
  }

  return end
}

/**
 * Computes the visible text for one pacing tick.
 *
 * @param text - Full latest text from the stream.
 * @param visibleText - Text currently shown in the UI.
 * @param isStreaming - Whether the source is still streaming.
 */
export function getNextPacedText(text: string, visibleText: string, isStreaming: boolean): string {
  if (!isStreaming) return text
  if (!text.startsWith(visibleText) || text.length <= visibleText.length) return text

  return text.slice(0, getNextPacedTextLength(text, visibleText.length))
}
