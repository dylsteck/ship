import type { ChatSession } from '@/lib/api/server'

/**
 * Merge remote session rows into local sidebar state.
 *
 * Keeps in-flight optimistic creates and local-only fields (title, sandbox, …)
 * when the remote row is missing them. Returns the previous array when the
 * merged result is equivalent so React can bail out of the updater.
 */
export function mergeRemoteSessions(
  local: ChatSession[],
  remote: ChatSession[],
  pendingCreateIds: ReadonlySet<string>,
): ChatSession[] {
  const remoteIds = new Set(remote.map((session) => session.id))
  const optimisticOnly = local.filter((session) => !remoteIds.has(session.id) && pendingCreateIds.has(session.id))
  const merged = remote.map((session) => overlayLocalSession(local.find((item) => item.id === session.id), session))
  const next = uniqueSessionsById([...optimisticOnly, ...merged])
  return areSessionListsEqual(local, next) ? local : next
}

/** Keep the first row for each session id so React lists never render duplicate keys. */
export function uniqueSessionsById(sessions: ChatSession[]): ChatSession[] {
  const seen = new Set<string>()
  let hasDuplicate = false
  for (const session of sessions) {
    if (seen.has(session.id)) {
      hasDuplicate = true
      break
    }
    seen.add(session.id)
  }
  if (!hasDuplicate) return sessions
  seen.clear()
  return sessions.filter((session) => {
    if (seen.has(session.id)) return false
    seen.add(session.id)
    return true
  })
}

/** Insert or replace a session without duplicating an id already present locally. */
export function upsertLocalSession(local: ChatSession[], session: ChatSession): ChatSession[] {
  const index = local.findIndex((item) => item.id === session.id)
  if (index < 0) return uniqueSessionsById([session, ...local])
  return local.map((item, itemIndex) => (itemIndex === index ? { ...item, ...session } : item))
}

function overlayLocalSession(local: ChatSession | undefined, remote: ChatSession): ChatSession {
  if (!local) return remote
  const next: ChatSession = {
    ...remote,
    title: remote.title || local.title,
    userId: remote.userId || local.userId,
    sandboxId: remote.sandboxId ?? local.sandboxId,
    sandboxStatus: remote.sandboxStatus ?? local.sandboxStatus,
    messageCount: remote.messageCount ?? local.messageCount,
    branch: remote.branch ?? local.branch,
  }
  return areSessionsEqual(remote, next) ? remote : next
}

function areSessionListsEqual(left: ChatSession[], right: ChatSession[]): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  return left.every((session, index) => areSessionsEqual(session, right[index]!))
}

function areSessionsEqual(left: ChatSession, right: ChatSession): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.repoOwner === right.repoOwner &&
    left.repoName === right.repoName &&
    left.status === right.status &&
    left.lastActivity === right.lastActivity &&
    left.createdAt === right.createdAt &&
    left.archivedAt === right.archivedAt &&
    left.title === right.title &&
    left.model === right.model &&
    left.agentType === right.agentType &&
    left.revision === right.revision &&
    left.sandboxId === right.sandboxId &&
    left.sandboxStatus === right.sandboxStatus &&
    left.messageCount === right.messageCount &&
    left.branch === right.branch
  )
}
