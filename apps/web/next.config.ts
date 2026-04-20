import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const config: NextConfig = {
  transpilePackages: ['@ship/ui'],
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      '',
  },
}

export default config

initOpenNextCloudflareForDev()
