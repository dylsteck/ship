'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only Tool card so Shiki stays out of the Worker SSR bundle.
 */
export const Tool = dynamic(() => import('@ship/ui').then((mod) => mod.Tool), {
  ssr: false,
})
