# E2B template: ACP backends + bridge

Ship injects a bundled **`ship-acp-bridge`** at runtime (`/tmp/ship-acp-bridge.mjs`), so a stock E2B image with **Node 22+** can work for development.

For production, bake the following into a **custom template** so cold starts stay fast and CLIs are pinned:

## Recommended layout

- Install **Node** (matching `engines` in repo `package.json`).
- Copy a built bridge (optional if you rely on runtime injection): e.g. `/opt/ship/acp-bridge.mjs`.
- Pin CLI binaries or npm globals:
  - **Codex**: `codex-acp` plus `@openai/codex` CLI (for enterprise `CODEX_ACCESS_TOKEN` login).
  - **Claude**: `claude-agent-acp` per [agentclientprotocol/claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp).
  - **Cursor**: Cursor CLI `agent` with subcommand `acp` ([docs](https://cursor.com/docs/cli/acp)) — verify redistribution/licensing before baking into public templates.
  - **OpenCode**: `opencode` with `acp` ([docs](https://opencode.ai/docs/acp/)).
- Drop `/opt/ship/ACP_VERSIONS.json` (optional) documenting pinned versions for operators.

## Environment inside the VM

The Worker injects secrets into the shell that starts the bridge (`CURSOR_*`, `OPENCODE_API_KEY`, `OPENAI_API_KEY`, `CODEX_ACCESS_TOKEN`, `CODEX_AUTH_JSON`, `ANTHROPIC_API_KEY`). For ChatGPT subscription auth, use **`CODEX_AUTH_JSON`** (paste `~/.codex/auth.json` after local `codex login`) or **`CODEX_ACCESS_TOKEN`** (enterprise tokens from chatgpt.com/admin/access-tokens). For multi-tenant deployments, **do not** bake global provider keys into the image — keep them in Worker secrets and inject per session (current MVP is single-tenant–friendly).

## Port

Default relay port **`9847`** — must match SessionDO meta `acp_relay_port` when overridden.

## After build

1. Publish the template with the E2B CLI / dashboard.
2. Set `E2B_TEMPLATE_ID` in `packages/sandbox/src/e2b.ts` (and any API duplicate) to the new template id.
3. Re-run `pnpm deploy` for the Worker.
