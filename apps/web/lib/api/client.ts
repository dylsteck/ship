/**
 * API Client Configuration
 * Base fetcher and utilities for SWR hooks
 */

export { API_URL } from '@/lib/config'
import { API_URL } from '@/lib/config'

let _apiToken: string | null = null

/** Set the API auth token (session JWT passed from server components) */
export function setApiToken(token: string): void {
  _apiToken = token
}

/** Get the current API auth token (for WebSocket connections that need query param auth) */
export function getApiToken(): string | null {
  return _apiToken
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_apiToken) headers['Authorization'] = `Bearer ${_apiToken}`
  if (extra) {
    const entries = extra instanceof Headers ? Array.from(extra.entries()) : Object.entries(extra)
    for (const [k, v] of entries) headers[k] = v as string
  }
  return headers
}

// Type-safe fetcher for SWR
export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: authHeaders(init?.headers as HeadersInit | undefined),
  })

  if (!res.ok) {
    const info = await res.json().catch(() => null)
    const message =
      info?.message ?? info?.error ?? `Request failed (${res.status} ${res.statusText})`
    const error = new Error(message)
    ;(error as Error & { info?: unknown; status?: number; url?: string }).info = info
    ;(error as Error & { info?: unknown; status?: number; url?: string }).status = res.status
    ;(error as Error & { info?: unknown; status?: number; url?: string }).url = url
    throw error
  }

  return res.json()
}

// Fetcher with credentials (for authenticated requests — auth header added automatically)
export async function authFetcher<T>(url: string): Promise<T> {
  return fetcher<T>(url)
}

// POST request helper
export async function post<TBody, TResponse>(
  url: string,
  body: TBody
): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const info = await res.json().catch(() => null)
    const message =
      info?.message ?? info?.error ?? `POST request failed (${res.status} ${res.statusText})`
    const error = new Error(message)
    ;(error as Error & { info?: unknown; status?: number; url?: string }).info = info
    ;(error as Error & { info?: unknown; status?: number; url?: string }).status = res.status
    ;(error as Error & { info?: unknown; status?: number; url?: string }).url = url
    throw error
  }

  return res.json()
}

// DELETE request helper
export async function del<TResponse = void>(url: string): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!res.ok) {
    const info = await res.json().catch(() => null)
    const message =
      info?.message ?? info?.error ?? `DELETE request failed (${res.status} ${res.statusText})`
    const error = new Error(message)
    ;(error as Error & { info?: unknown; status?: number; url?: string }).info = info
    ;(error as Error & { info?: unknown; status?: number; url?: string }).status = res.status
    ;(error as Error & { info?: unknown; status?: number; url?: string }).url = url
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
