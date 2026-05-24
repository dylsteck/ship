const MODE_STORAGE_KEY = 'ship-chat-mode'

export function getStoredMode(): import('@/lib/api/types').AgentModeId {
  try {
    const s = localStorage.getItem(MODE_STORAGE_KEY)
    if (s === 'build' || s === 'plan') return s
  } catch {
    // ignore
  }
  return 'build'
}

export function setStoredMode(mode: import('@/lib/api/types').AgentModeId): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

export const DEFAULT_ACP_MODEL_ID = 'ship-acp-opencode'

export const DEFAULT_MODES: import('@/lib/api/types').AgentMode[] = [
  { id: 'build', label: 'build' },
  { id: 'plan', label: 'plan' },
]
