/**
 * @ship/sdk — typed REST client for the Ship API.
 *
 * Generated from `apps/api/openapi/ship-api.openapi.json` via Hey API.
 * SSE streaming lives in `@ship/sdk/streaming`; service calls in `@ship/sdk/service`.
 */

export * from './generated/sdk.gen'
export * from './generated/types.gen'
export { client } from './generated/client.gen'
export {
  configureShipClient,
  isShipClientConfigured,
  toShipError,
  unwrapSdkData,
  type ShipApiError,
  type ShipClientConfig,
} from './runtime/configure'
