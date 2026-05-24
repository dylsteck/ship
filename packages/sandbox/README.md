# @ship/sandbox

Sandbox abstraction and E2B implementation for provisioning agent workspaces.

## Exports

```typescript
import { connectSandbox, E2B_TEMPLATE_ID, type Sandbox } from '@ship/sandbox'
```

| Module | Contents |
|--------|----------|
| `@ship/sandbox` | Factory + E2B adapter |
| `@ship/sandbox/interface` | `Sandbox`, `SandboxState` types |
| `@ship/sandbox/e2b` | Low-level E2B SDK wrappers |

## E2B custom template (production)

Ship injects **`ship-acp-bridge`** at runtime (`/tmp/ship-acp-bridge.mjs`), so a stock E2B image with **Node 22+** works for local dev.

For production, bake into a **custom template** for faster cold starts:

- **Node** matching repo `engines` in root `package.json`
- Optional pinned bridge at `/opt/ship/acp-bridge.mjs`
- ACP backend CLIs: OpenCode (`opencode acp`), Cursor (`agent acp`), Claude (`claude-agent-acp`), Codex (`codex-acp`)

The Worker injects provider secrets per session (`OPENCODE_API_KEY`, `CODEX_AUTH_JSON`, etc.). Do not bake global keys into public images for multi-tenant deployments.

Default ACP relay port: **9847** (must match Session DO `acp_relay_port` if overridden).

After publishing a template, set `E2B_TEMPLATE_ID` in `packages/sandbox/src/e2b.ts` and redeploy the Worker.

## Scripts

```bash
pnpm --filter @ship/sandbox typecheck
```
