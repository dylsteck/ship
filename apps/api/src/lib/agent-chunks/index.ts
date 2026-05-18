/**
 * Ship chat streaming — maps ACP JSON-RPC notifications to Ship's legacy SSE shapes.
 *
 * @packageDocumentation
 */

export type { ShipSSEEvent, StepFinishTotals } from './events'
export {
  makeStepFinishEvent,
  totalsFromUsage,
  emptyStepTotals,
  makeSessionErrorEvent,
  makeMessagePartUpdated,
} from './events'
export { createTranslatorState, type TranslatorState } from './state'
export { createAcpNotificationTranslator, type AcpNotificationTranslator } from './acp-translator'
