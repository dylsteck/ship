export interface SessionUserInfo {
  user: User | undefined
  authProvider?: 'github' | 'vercel'
}

export interface Tokens {
  accessToken: string
  expiresAt?: number
  refreshToken?: string
}

export interface Session {
  created: number
  authProvider: 'github' | 'vercel'
  user: User
}

interface User {
  id: string
  username: string
  email: string | undefined
  avatar: string
  name?: string
}
