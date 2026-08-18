'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only Markdown so Streamdown and mermaid stay out of the Worker SSR bundle.
 */
export const Markdown = dynamic(() => import('./markdown').then((mod) => mod.Markdown), {
  ssr: false,
})
