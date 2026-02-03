# OpenCode + E2B Integration Context

**Date:** 2026-02-02
**Issue:** Chat endpoint returns 500 because OpenCode client tries to connect to localhost:4096

## Root Cause

The `opencode.ts` file tries to connect to a local OpenCode server:
```typescript
// In production, isNode = false in CF Workers
clientInstance = createOpencodeClient({
  baseUrl: `http://127.0.0.1:4096`,  // WRONG - doesn't exist!
})
```

CF Workers cannot access localhost. OpenCode should run INSIDE the E2B sandbox.

## Correct Architecture (per Ramp)

```
┌─────────────────────────────────────────────────────────────┐
│                    E2B Sandbox                               │
│  ┌────────────────┐                                         │
│  │ OpenCode Server │◄─── opencode serve --port 4096         │
│  │   (port 4096)   │                                         │
│  └────────┬───────┘                                         │
│           │                                                  │
│           │ localhost:4096                                   │
│           ▼                                                  │
│  ┌────────────────┐                                         │
│  │  Public URL    │◄─── sandbox.getHost(4096)               │
│  │ (e2b tunnels)  │     returns: "4096-{id}.e2b.dev"        │
│  └────────┬───────┘                                         │
└───────────┼─────────────────────────────────────────────────┘
            │
            │ HTTPS (public internet)
            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker                            │
│                                                              │
│  createOpencodeClient({                                      │
│    baseUrl: 'https://4096-{id}.e2b.dev'  // ✓ Works!        │
│  })                                                          │
└─────────────────────────────────────────────────────────────┘
```

## E2B Key Methods

From E2B docs (https://e2b.dev/docs/llms-full.txt):

### Running background processes
```typescript
const proc = await sandbox.commands.run('opencode serve', {
  background: true,
  onStdout: (data) => console.log(data),
  onStderr: (data) => console.error(data),
})
```

### Getting public URL for a port
```typescript
const host = sandbox.getHost(4096)
// Returns: "4096-{sandbox-id}.e2b.dev"
const url = `https://${host}`
```

## Implementation Checklist

- [ ] Add `startOpenCodeServer()` to `e2b.ts`
- [ ] Add `waitForServer()` health check helper
- [ ] Update `opencode.ts` to accept baseUrl parameter
- [ ] Update `chat.ts` to get sandbox URL and create client
- [ ] Store `opencode_url` in session meta for reuse
- [ ] Ensure E2B template has OpenCode installed (or install on first use)

## Files to Modify

1. `apps/api/src/lib/e2b.ts` - Add server startup + URL retrieval
2. `apps/api/src/lib/opencode.ts` - Remove localhost, accept URL param
3. `apps/api/src/routes/chat.ts` - Wire it together
4. `apps/api/src/durable-objects/session.ts` - Store opencode_url

## References

- Ramp architecture: https://builders.ramp.com/post/why-we-built-our-background-agent
- E2B docs: https://e2b.dev/docs/llms-full.txt
- E2B getHost: https://e2b.dev/docs/sandbox/internet-access
