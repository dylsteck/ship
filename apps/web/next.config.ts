import type { NextConfig } from 'next'

/**
 * Default API URL when neither `NEXT_PUBLIC_API_URL` nor `API_BASE_URL`
 * is set — matches `wrangler dev` so `pnpm dev` "just works" without
 * requiring an `.env.local`. Preview / production deploys must set the
 * env explicitly.
 */
const LOCAL_API_URL = 'http://localhost:8787'

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@ship/ui'],
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      LOCAL_API_URL,
  },
}

export default config
