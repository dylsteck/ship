# @ship/config

Shared TypeScript compiler configs for the monorepo.

## Files

| Config | Extends | Used by |
|--------|---------|---------|
| `typescript/base.json` | — | Packages, shared baseline |
| `typescript/nextjs.json` | base | `apps/web` |
| `typescript/worker.json` | base | `apps/api` |

## Usage

In a package `tsconfig.json`:

```json
{
  "extends": "@ship/config/typescript/base.json"
}
```

Path references use the workspace package name; no build step — configs are consumed directly by `tsc`.
