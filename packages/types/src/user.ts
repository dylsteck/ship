/**
 * User types for Ship application
 */

export interface User {
  id: string
  githubId: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface CreateUserInput {
  githubId: string
  username: string
  email?: string
  name?: string
  avatarUrl?: string
}

export interface UserDTO {
  id: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}
