'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ThemeColorSync } from './theme-color-sync'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
