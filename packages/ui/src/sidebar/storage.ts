import { SIDEBAR_STORAGE_KEY } from './constants'

/** Read persisted sidebar open state from localStorage. */
export function getStoredSidebarState(fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // localStorage unavailable
  }
  return fallback
}
