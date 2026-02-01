import { deleteSession } from '@/lib/session'

export async function GET(): Promise<Response> {
  await deleteSession()

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/login',
    },
  })
}
