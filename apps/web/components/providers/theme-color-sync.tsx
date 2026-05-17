'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

const THEME_COLORS = { light: '#ffffff', dark: '#0d0d0d' }

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const color = THEME_COLORS[resolvedTheme as keyof typeof THEME_COLORS]
    if (!color) return

    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = color
      })
  }, [resolvedTheme])

  return null
}
