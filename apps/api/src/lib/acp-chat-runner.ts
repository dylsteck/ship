/**
 * Orchestrates one chat turn against an **ACP CLI running inside the E2B sandbox**.
 *
 * @remarks
 * The Worker never spawns subprocesses locally. {@link ensureAcpBridgeReady} starts
 * `ship-acp-bridge` in the VM; this module opens WSS, runs JSON-RPC (`initialize`,
 * `authenticate`, `session/prompt`), and streams {@link ShipSSEEvent}s for the web app.
 *
 * @packageDocumentation
 */

export { runChatTurn, type RunChatTurnInput, type ChatTurnResult } from './acp-chat-turn-run'
