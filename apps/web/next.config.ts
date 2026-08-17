import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/**
 * Default API URL when neither `NEXT_PUBLIC_API_URL` nor `API_BASE_URL`
 * is set — matches `wrangler dev` so `pnpm dev` "just works" without
 * requiring an `.env.local`. Preview / production deploys must set the
 * env explicitly.
 */
const LOCAL_API_URL = 'http://localhost:8787'

const config: NextConfig = {
  // Docker / Coolify uses Next standalone. Cloudflare Workers builds omit this
  // so OpenNext can emit `.open-next/`.
  ...(process.env.DEPLOY_TARGET === 'node' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@ship/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/u/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      LOCAL_API_URL,
  },
}

export default config

if (process.env.NODE_ENV !== 'production') {
  initOpenNextCloudflareForDev()
}
