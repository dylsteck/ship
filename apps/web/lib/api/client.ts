/**
 * @deprecated Import from `@/lib/api/configure` or `@/lib/api`.
 */
export { setApiToken, getApiToken, configureWebShipClient, API_URL } from './configure'
export { wsUrl } from './ws'

/** @deprecated Use SDK hooks instead of raw fetcher */
export async function fetcher<T>(_url: string): Promise<T> {
  throw new Error('fetcher is deprecated — use @ship/sdk via hooks')
}

export async function authFetcher<T>(_url: string): Promise<T> {
  throw new Error('authFetcher is deprecated — use @ship/sdk via hooks')
}

export async function post<TBody, TResponse>(_url: string, _body: TBody): Promise<TResponse> {
  throw new Error('post is deprecated — use @ship/sdk')
}

export async function del<TResponse>(_url: string): Promise<TResponse> {
  throw new Error('del is deprecated — use @ship/sdk')
}

export function apiUrl(_path: string): string {
  throw new Error('apiUrl is deprecated — use @ship/sdk')
}

export function chatFetchHeaders(): Record<string, string> {
  throw new Error('chatFetchHeaders is deprecated — use @ship/sdk')
}
