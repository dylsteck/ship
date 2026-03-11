import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './session'

const API_SECRET = process.env.API_SECRET

function serverAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
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
  const session = await verifySession()

  const response = await fetch(`${process.env.API_BASE_URL}/users/${session.userId}`, {
    headers: serverAuthHeaders(),
  })

  if (!response.ok) {
    redirect('/login')
  }

  return response.json()
})
