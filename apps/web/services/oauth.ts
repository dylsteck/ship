import type { CreateUserInput } from '@ship/types'
import { createShipServiceClient } from '@ship/sdk/service'
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

function serviceClient() {
  if (!API_SECRET) throw new Error('API_SECRET is not configured')
  return createShipServiceClient({ baseUrl: API_URL, apiSecret: API_SECRET })
}

/**
 * Create or update a Ship user from a GitHub OAuth profile.
 */
export async function upsertOAuthUser(input: CreateUserInput): Promise<UpsertOAuthUserResult> {
  const client = serviceClient()
  const result = await client.upsertUser({
    githubId: input.githubId,
    username: input.username,
    email: input.email,
    name: input.name,
    avatarUrl: input.avatarUrl,
  })

  if (result.data) {
    return { ok: true, userId: result.data.userId, isNewUser: result.data.isNewUser }
  }

  if (result.response?.status === 403) {
    return { ok: false, accessRestricted: true }
  }

  return { ok: false, accessRestricted: false }
}

/**
 * Store the GitHub OAuth token metadata used for repository access.
 */
export async function storeGitHubOAuthAccount(input: StoreGitHubAccountInput): Promise<void> {
  const client = serviceClient()
  await client.storeGitHubAccount({
    userId: input.userId,
    providerAccountId: input.providerAccountId,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? undefined,
    expiresAt: input.expiresAt ?? undefined,
    tokenType: input.tokenType,
    scope: input.scope,
  })
}
