# Effect layer (`apps/api/src/effect`)

This directory is the foundation of Ship's migration to [Effect](https://effect.website).
The goal is to make the codebase **entirely Effect-based** for end-to-end type
safety — every async operation declares its dependencies and failure modes in
its type (`Effect<A, E, R>`), and every external boundary (DB, GitHub, E2B) is an
injectable service with tagged errors.

## What lives here today

| File | Purpose |
| --- | --- |
| `errors.ts` | Tagged error hierarchy (`Data.TaggedError`) + `toHttpErrorResponse` mapping. Every failure is a typed value in the error channel, not a `throw`. |
| `services.ts` | DI seams: `Database` (the D1 binding) and `OAuthConfig` as Effect service tags. |
| `runtime.ts` | The shared `ManagedRuntime` and the `runPromise` boundary executors. Effects are built everywhere but only *run* at boundaries. |
| `github-tokens.ts` | First real service: GitHub OAuth token resolution as `Effect.gen`, with the live `Layer` wired from `Database` + `OAuthConfig`. |
| `compute.ts` | Effect-native wrappers around the E2B compute-provider helpers, with tagged sandbox errors. |

## Design rules

1. **No `throw` inside the Effect layer.** Failures are `Data.TaggedError`s in the
   error channel and handled with `Effect.catchTag`.
2. **Bindings are injected, never imported.** Worker `env` resources are provided
   as services (`Database`, `OAuthConfig`, …) so code is testable with fakes.
3. **Run only at the edge.** Construct effects freely; call `runPromise` exactly
   at HTTP handlers / Durable Object methods.
4. **Behaviour is preserved during migration.** Legacy modules (e.g.
   `lib/github-token.ts`) keep their exact public signatures and delegate to the
   Effect implementation, so callers are unchanged.

## Roadmap to "entirely Effect-ified"

This first wave establishes the patterns. Subsequent waves (tracked separately):

- **Schema everywhere** — migrate `packages/contracts` from zod to `effect/Schema`
  (keeping the OpenAPI export green), then derive the SDK client from it.
- **Services for every boundary** — octokit/GitHub, E2B sandbox lifecycle, D1
  access, KV/DO state — each as a `Context.Tag` + `Layer`.
- **HttpApi** — re-express routes with `@effect/platform` `HttpApi` and port the
  auth / rate-limit middleware to `HttpApiMiddleware`.
- **Durable Objects** — wrap the `session-*-store` DOs in Effect.
- **Observability** — `@effect/opentelemetry` layer + `Effect.fn` spans.
- **Alchemy v2** — once published to a stable channel, fold `wrangler.toml` and the
  deploy scripts into a single `alchemy.run.ts` "infrastructure-as-effects"
  program (Effect 4.x).
