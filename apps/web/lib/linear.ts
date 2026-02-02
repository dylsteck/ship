import { Linear } from 'arctic'

export const linear = new Linear(
  process.env.LINEAR_CLIENT_ID!,
  process.env.LINEAR_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linear/callback`
)
