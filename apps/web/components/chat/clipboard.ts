/** Attempts to copy text, falling back when browser clipboard permissions are unavailable. */
export async function copyPlainText(value: string): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value)
      return true
    } catch {
      return copyWithTextarea(value)
    }
  }

  return copyWithTextarea(value)
}

function copyWithTextarea(value: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false

  const selection = document.getSelection()
  const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.left = '-9999px'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  textArea.style.position = 'fixed'
  textArea.style.top = '0'

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  textArea.setSelectionRange(0, textArea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textArea)
    if (selection && selectedRange) {
      selection.removeAllRanges()
      selection.addRange(selectedRange)
    }
  }
}
