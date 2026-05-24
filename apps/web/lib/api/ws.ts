/**
 * WebSocket URL helper for session sync and terminal.
 */
import { API_URL } from '@/lib/config'
import { buildWsUrl } from '@ship/sdk/ws'
import { getApiToken } from './configure'

/** Build WebSocket URL with JWT query param. */
export function wsUrl(path: string): string {
  return buildWsUrl(API_URL, path, getApiToken())
}
