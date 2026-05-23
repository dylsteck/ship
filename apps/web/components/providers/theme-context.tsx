'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: string) => void
  resolvedTheme?: ResolvedTheme
  systemTheme?: ResolvedTheme
  themes: Theme[]
}

const THEME_STORAGE_KEY = 'theme'
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#0d0d0d' }
const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {}
  return 'system'
}

function applyTheme(theme: Theme, systemTheme: ResolvedTheme) {
  const resolvedTheme = theme === 'system' ? systemTheme : theme
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  document.documentElement.style.colorScheme = resolvedTheme
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = THEME_COLORS[resolvedTheme]
  })
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme | undefined>(undefined)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = () => setSystemTheme(getSystemTheme())

    setThemeState(readStoredTheme())
    syncSystemTheme()
    media.addEventListener('change', syncSystemTheme)
    return () => media.removeEventListener('change', syncSystemTheme)
  }, [])

  useEffect(() => {
    if (!systemTheme) return
    applyTheme(theme, systemTheme)
  }, [theme, systemTheme])

  const setTheme = useCallback((nextTheme: string) => {
    const normalizedTheme: Theme =
      nextTheme === 'light' || nextTheme === 'dark' || nextTheme === 'system' ? nextTheme : 'system'
    setThemeState(normalizedTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme)
    } catch {}
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme: systemTheme ? (theme === 'system' ? systemTheme : theme) : undefined,
      systemTheme,
      themes: ['light', 'dark', 'system'],
    }),
    [setTheme, systemTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
