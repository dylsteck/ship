# @ship/ui

Shared React component library for Ship — shadcn-style primitives plus **AI Elements** for chat UI.

## Install

```json
{ "dependencies": { "@ship/ui": "workspace:*" } }
```

## Imports

```typescript
import { Button, Sidebar, Message, Tool, Conversation } from '@ship/ui'
import { cn } from '@ship/ui/utils'
```

## Layout

| Directory | Contents |
|-----------|----------|
| `src/*.tsx` | Base components (Button, Sheet, Sidebar, …) |
| `src/ai-elements/` | Chat components (Message, Tool, Reasoning, PromptInput, …) |

Used primarily by `apps/web`. Requires React 19 peer dependencies.

## Scripts

```bash
pnpm --filter @ship/ui lint
```

See `.agents/skills/ai-elements/` for patterns when adding new AI chat components.
