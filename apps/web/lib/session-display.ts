import type { ChatSession } from '@/lib/api/server'

export function getSessionRepoLabel(
  session?: Pick<ChatSession, 'repoOwner' | 'repoName'> | null,
): string | undefined {
  if (!session?.repoOwner || !session.repoName) return undefined
  return `${session.repoOwner}/${session.repoName}`
}

export function getSessionDisplayTitle(
  session?: Pick<ChatSession, 'title' | 'repoName'> | null,
  options?: {
    preferredTitle?: string | null
    fallbackTitle?: string | null
  },
): string | undefined {
  const preferredTitle = options?.preferredTitle?.trim()
  if (preferredTitle) return preferredTitle

  const persistedTitle = session?.title?.trim()
  if (persistedTitle) return persistedTitle

  const fallbackTitle = options?.fallbackTitle?.trim()
  if (fallbackTitle) return fallbackTitle

  return session?.repoName
}
