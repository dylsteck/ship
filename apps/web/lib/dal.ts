import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './session'

export const verifySession = cache(async () => {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

export const getUser = cache(async () => {
  const session = await verifySession()

  const response = await fetch(`${process.env.API_BASE_URL}/users/${session.userId}`)

  if (!response.ok) {
    redirect('/login')
  }

  return response.json()
})
