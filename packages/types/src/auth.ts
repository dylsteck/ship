/**
 * Authentication types for Ship application
 */

export interface Session {
  id: string
  userId: string
  expiresAt: number
  createdAt: number
}

export interface Account {
  id: string
  userId: string
  provider: string
  providerAccountId: string
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
}
