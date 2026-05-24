import { cache } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { configureShipClient, getUsersMe, unwrapSdkData } from '@ship/sdk'
import { getSession } from './session'
import { API_URL } from './config'

export const verifySession = cache(async () => {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

export const getUser = cache(async () => {
  await verifySession()

  const cookieStore = await cookies()
  const jwt = cookieStore.get('session')?.value ?? null
  configureShipClient({ baseUrl: API_URL, getAuthToken: () => jwt })

  try {
    return unwrapSdkData(await getUsersMe())
  } catch {
    redirect('/login')
  }
})
