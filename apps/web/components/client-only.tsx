'use client'

import { useState, useEffect } from 'react'

/**
 * Renders children only after the component has mounted on the client.
 * Use this to avoid hydration mismatches with components that generate
 * non-deterministic IDs (e.g. Base UI DropdownMenu) between server and client.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <>{children}</> : <>{fallback}</>
}
