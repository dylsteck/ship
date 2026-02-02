/**
 * API Module
 * 
 * Centralized API client with SWR hooks for type-safe data fetching.
 * 
 * Usage:
 * ```tsx
 * import { useModels, useGitHubRepos, useCreateSession } from '@/lib/api'
 * 
 * function MyComponent() {
 *   const { models, isLoading } = useModels()
 *   const { repos } = useGitHubRepos(userId)
 *   const { createSession } = useCreateSession()
 *   // ...
 * }
 * ```
 */

// Re-export server-side API functions (for Server Components/Actions)
export * from './server'

// Re-export all hooks (for Client Components)
export * from './hooks'

// Re-export types
export * from './types'

// Re-export client utilities (for advanced usage)
export { API_URL, fetcher, authFetcher, post, del, apiUrl, wsUrl } from './client'
