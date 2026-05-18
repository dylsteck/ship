# Architecture

This document explains how Ship fits together — complementary to `README.md`
(product + setup).

## One-line view

Ship is a hosted coding-agent chat platform: **ACP backends run inside each E2B
sandbox** on the cloned repo. The Cloudflare Worker orchestrates sandbox +
repo setup, writes **`ship-acp-bridge`** into the VM, opens **WSS** to it, and
translates Agent Client Protocol traffic into Ship's legacy SSE channel so the
Next.js dashboard stays compatible.

## System shape

```text
+------------------+     SSE / HTTP      +---------------------------+
|  Next.js Web     |<------------------>|  Cloudflare Worker (API)  |
|  apps/web        |                    |  apps/api                 |
+------------------+                    +-----------+---------------+
        |                                           |
        | WebSocket (live sync, SessionDO)           |
        |                                           |
        |                               prepare + bridge bootstrap
        |                                           v
        |                               +----------------------+
        |                               | SessionDO + D1       |
        |                               +----------+-----------+
        |                                           |
        |                               WSS + JSON-RPC
        |                                           v
        +------------------------------->+----------------------+
                                         | E2B Sandbox VM       |
                                         | ship-acp-bridge      |
                                         |  → ACP CLI (stdio)   |
                                         +----------------------+
```

## Design goals reflected in the code

- **Brains in the sandbox** — Tooling and file edits follow the vendor ACP CLI;
  the Worker does not run an AI SDK `streamText` loop.
- **Stable IO surface** — `@ship/sandbox` (`exec`, files, `domain(port)`) is
  still the integration seam for clones + bridge health checks + logs.
- **Bridge security** — Per-session `SHIP_BRIDGE_TOKEN` minted in SessionDO;
  WSS uses `?token=` because Workers WebSocket clients cannot rely on custom
  headers; traffic stays on TLS’d tunnel URLs.
- **Durable UX primitives** — SessionDO SQLite + websocket broadcast preserve
  chat + sandbox meta across Worker isolates.
- **Optional durability** — `ShipAcpBootstrapWorkflow` is exported for future
  checkpointed bootstrap retries (`wrangler.toml` binding `SHIP_ACP_WORKFLOW`);
  `/chat` streaming remains synchronous today.

## Major components

### `apps/web` — Next.js frontend

Dashboard chat UI, SSE client, Streamdown rendering, SessionDO websocket sync.

### `apps/api` — Cloudflare Worker

Hono routes (`/chat`, `/sessions`, `/sandbox`, `/models`, `/git`, …), SessionDO
RPC, E2B provisioning, **`acp-chat-runner`** turn orchestration, **`bundle-acp-bridge`**
generated `ACP_BRIDGE_BUNDLE`, Cloudflare Workflow export.

### `packages/acp-bridge`

Node HTTP (`/healthz`) + WebSocket (`/ship-acp`) server bundled via esbuild into
`apps/api/src/generated/acp-bridge-bundled.ts`.

### `packages/sandbox`

`Sandbox` interface + `E2BSandboxAdapter` (`@e2b/code-interpreter`).

### `packages/ui`, `packages/types`

Shared UI primitives and TS types.

## Session lifecycle (abbreviated)

1. **Create session** — D1 row + SessionDO meta; sandbox provisioning kicks off.
2. **Sandbox ready** — `sandbox_id` stored on SessionDO.
3. **Chat turn** — `prepareWorkspace` clones via GitHub OAuth token when linked.
4. **Bridge** — Token + relay port meta idempotently created; `/tmp` script +
   `nohup node …`.
5. **Chat** — Worker connects WSS, spawns backend (`codex` \| `claude` \| `cursor` \| `opencode`),
   drives JSON-RPC handshake + prompt.

## One chat turn (`POST /chat/:sessionId`)

1. Authenticate + persist user message (SessionDO).
2. **`prepareWorkspace`** — sandbox attach + repo path resolution.
3. **`ensureAcpBridgeReady`** — write bundle, export secrets for shell env,
   health poll `GET …/healthz`.
4. **`openBridgeWebSocket`** — `wss://…/ship-acp?token=…`.
5. **`sendCtl`** — spawn backend kind derived from `ship-acp-*` model meta.
6. **`runHandshake`** — `initialize` → `authenticate` → `session/new` \| `session/load`.
7. **`session/prompt`** — transcript assembled via `chat-history.ts`.
8. **Streaming** — JSON-RPC notifications → `createAcpNotificationTranslator`.
9. **`step-finish`**, **`session.idle`**, **`done`** + assistant persistence.

## ACP notification → SSE

Heuristic extraction maps streaming assistant deltas into existing
`message.part.updated` parts so Streamdown keeps working.

## Persistence

Unchanged high-level split:

- **D1** — users, sessions index, preferences.
- **SessionDO SQLite** — messages, tasks, `session_meta` (`model`,
  `acp_*` keys, sandbox/git fields).

## Models

Picker IDs are **`ship-acp-{opencode,cursor,claude,codex}`** (see `agent-registry.ts`).

## Secrets (Worker)

Core: `E2B_API_KEY`, `API_SECRET`, `SESSION_SECRET`, GitHub OAuth.

Optional backend auth (injected during bridge bootstrap for single-tenant MVP):
`CURSOR_API_KEY`, `CURSOR_AUTH_TOKEN`, `OPENCODE_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`.

Session title helper: `generate-session-title.ts` (Anthropic → OpenAI REST).

## Read next

- `README.md`
- `AGENTS.md`
- `apps/api/src/lib/acp-chat-runner.ts`
- `packages/acp-bridge/src/server.ts`
- `scripts/e2b-template/README.md`
