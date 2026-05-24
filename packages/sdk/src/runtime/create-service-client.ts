/**
 * Service-token client for server-to-server API calls (OAuth upsert, account storage).
 */

import { createClient, createConfig } from '../generated/client'
import * as sdk from '../generated/sdk.gen'
import type { GitHubAccountBody, UpsertUserBody } from '../generated/types.gen'

/** Options for the service (API_SECRET) client. */
export interface ShipServiceClientOptions {
  baseUrl: string
  apiSecret: string
}

/**
 * Create an isolated client authenticated with `API_SECRET`.
 *
 * @remarks Never use this in browser code — service token is server-only.
 */
export function createShipServiceClient(options: ShipServiceClientOptions) {
  const serviceClient = createClient(
    createConfig({
      baseUrl: options.baseUrl,
      auth: options.apiSecret,
    }),
  )

  return {
    client: serviceClient,
    upsertUser: (body: UpsertUserBody) => sdk.postUsersUpsert({ client: serviceClient, body }),
    storeGitHubAccount: (body: GitHubAccountBody) => sdk.postAccountsGithub({ client: serviceClient, body }),
  }
}
