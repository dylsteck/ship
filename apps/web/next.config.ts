import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/**
 * Default API URL when neither `NEXT_PUBLIC_API_URL` nor `API_BASE_URL`
 * is set — matches `wrangler dev` so `pnpm dev` "just works" without
 * requiring an `.env.local`. Preview / production deploys must set the
 * env explicitly.
 */
const LOCAL_API_URL = 'http://localhost:8787'

/**
 * Packages that belong only in client chunks (syntax highlighting, diffs,
 * terminal). Do not list these in `serverExternalPackages` — OpenNext's
 * Worker bundler follows those `require()`s and inlines the full package
 * into the 3 MiB gzip script.
 */
const CLIENT_ONLY_PACKAGES = [
  'shiki',
  'mermaid',
  'streamdown',
  '@streamdown/code',
  '@streamdown/mermaid',
  '@pierre/diffs',
  '@pierre/diffs/react',
  '@xterm/xterm',
  '@xterm/addon-fit',
  '@xterm/addon-web-links',
] as const

const config: NextConfig = {
  // Docker / Coolify uses Next standalone. Cloudflare Workers builds omit this
  // so OpenNext can emit `.open-next/`.
  ...(process.env.DEPLOY_TARGET === 'node' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@ship/ui'],
  experimental: {
    optimizePackageImports: ['@ship/ui', '@hugeicons/core-free-icons', '@hugeicons/react'],
  },
  webpack: (webpackConfig, { isServer }) => {
    if (!isServer) return webpackConfig
    webpackConfig.resolve ??= {}
    const alias =
      webpackConfig.resolve.alias && !Array.isArray(webpackConfig.resolve.alias)
        ? webpackConfig.resolve.alias
        : {}
    webpackConfig.resolve.alias = {
      ...alias,
      ...Object.fromEntries(CLIENT_ONLY_PACKAGES.map((name) => [name, false])),
    }
    return webpackConfig
  },
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
