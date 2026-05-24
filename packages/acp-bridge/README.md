# @ship/acp-bridge

Localhost HTTP + WebSocket relay that spawns ACP agent CLIs and forwards **NDJSON JSON-RPC** on stdio.

The Cloudflare Worker bundles this into `apps/api/src/generated/acp-bridge-bundled.ts` and drops it into each E2B sandbox at `/tmp/ship-acp-bridge.mjs`.

## Build

```bash
pnpm --filter @ship/acp-bridge build
# → dist/bundle.mjs
```

The API Worker runs `scripts/bundle-acp-bridge.mjs` before dev/deploy/typecheck.

## Runtime flow

```
Worker (WSS) → bridge (localhost:9847) → ctl.spawn → ACP CLI stdio
```

See `src/server.ts` for the relay implementation and `AGENTS.md` for backend kinds (OpenCode, Cursor, Claude, Codex).
