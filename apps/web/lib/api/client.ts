/**
 * API Client Configuration
 * Base fetcher and utilities for SWR hooks
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:8787'

// Type-safe fetcher for SWR
export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // Attach extra info to the error object
    ;(error as any).info = await res.json().catch(() => null)
    ;(error as any).status = res.status
    throw error
  }

  return res.json()
}

// Fetcher with credentials (for authenticated requests)
export async function authFetcher<T>(url: string): Promise<T> {
  return fetcher<T>(url, { credentials: 'include' })
}

// POST request helper
export async function post<TBody, TResponse>(
  url: string,
  body: TBody
): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  })

  if (!res.ok) {
    const error = new Error('POST request failed')
    ;(error as any).info = await res.json().catch(() => null)
    ;(error as any).status = res.status
    throw error
  }

  return res.json()
}

// DELETE request helper
export async function del<TResponse = void>(url: string): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) {
    const error = new Error('DELETE request failed')
    ;(error as any).info = await res.json().catch(() => null)
    ;(error as any).status = res.status
    throw error
  }

  // Return empty object for void responses
  const text = await res.text()
  return text ? JSON.parse(text) : ({} as TResponse)
}

// Build API URL with query params
export function apiUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, API_URL)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

// WebSocket URL builder
export function wsUrl(path: string): string {
  return `${API_URL.replace('http', 'ws')}${path}`
}
