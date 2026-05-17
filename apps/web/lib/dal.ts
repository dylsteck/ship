import { cache } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSession } from './session'

const API_SECRET = process.env.API_SECRET

/**
 * Auth headers for server-side `API_BASE_URL` calls. Prefers session JWT from cookie.
 */
async function serverAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const cookieStore = await cookies()
  const jwt = cookieStore.get('session')?.value
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`
    return headers
  }
  if (API_SECRET) headers['Authorization'] = `Bearer ${API_SECRET}`
  return headers
}

export const verifySession = cache(async () => {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

export const getUser = cache(async () => {
  await verifySession()

  const response = await fetch(`${process.env.API_BASE_URL}/users/me`, {
    headers: await serverAuthHeaders(),
  })

  if (!response.ok) {
    redirect('/login')
  }

  return response.json()
})
