'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only tool cards so Shiki/CodeBlock stay out of the Worker SSR bundle.
 */
export const MessageToolList = dynamic(() => import('./tool-list').then((mod) => mod.MessageToolList), {
  ssr: false,
})
