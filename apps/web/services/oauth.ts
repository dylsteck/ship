import type { CreateUserInput } from '@ship/types'
import { API_URL } from '@/lib/config'

const API_SECRET = process.env.API_SECRET

/** Result from the OAuth-only user upsert endpoint. */
export type UpsertOAuthUserResult =
  | { ok: true; userId: string; isNewUser: boolean }
  | { ok: false; accessRestricted: boolean }

/** Data persisted for the linked GitHub account after OAuth sign-in. */
export interface StoreGitHubAccountInput {
  userId: string
  providerAccountId: string
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
  tokenType: string
  scope: string
}

function serviceAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_SECRET}`,
  }
}

/**
 * Create or update a Ship user from a GitHub OAuth profile.
 *
 * @param input - User fields accepted by the Worker OAuth upsert route.
 */
export async function upsertOAuthUser(input: CreateUserInput): Promise<UpsertOAuthUserResult> {
  const response = await fetch(`${API_URL}/users/upsert`, {
    method: 'POST',
    headers: serviceAuthHeaders(),
    body: JSON.stringify(input),
  })

  if (response.ok) {
    const body = (await response.json()) as { userId: string; isNewUser: boolean }
    return { ok: true, userId: body.userId, isNewUser: body.isNewUser }
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => null)
    if (body?.error === 'access_restricted') {
      return { ok: false, accessRestricted: true }
    }
  }

  return { ok: false, accessRestricted: false }
}

/**
 * Store the GitHub OAuth token metadata used for repository access.
 *
 * @param input - Account token payload accepted by the Worker account route.
 */
export async function storeGitHubOAuthAccount(input: StoreGitHubAccountInput): Promise<void> {
  await fetch(`${API_URL}/accounts/github`, {
    method: 'POST',
    headers: serviceAuthHeaders(),
    body: JSON.stringify(input),
  })
}
