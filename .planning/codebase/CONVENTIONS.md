# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` - `TaskForm.tsx`, `TaskDetails.tsx`, `AppLayout.tsx`
- Utility/helper files: `camelCase.ts` - `logging.ts`, `id.ts`, `rate-limit.ts`
- Route handlers: `route.ts` (following Next.js App Router convention)
- Index/barrel files: `index.ts` - used in `components/dialogs/`, `components/ui/`, `lib/atoms/`
- Prefixed utilities: `create-github.ts`, `get-oauth-token.ts`, `get-server-session.ts` (kebab-case for multi-word utilities)

**Functions:**
- Regular functions: `camelCase` - `createGitHubSession()`, `executeAgentInSandbox()`, `detectPackageManager()`
- Hook functions: `usePrefixNoun` (React custom hooks) - `useTasks()` in `app-layout.tsx`
- Handler functions: `handleVerbNoun` - `handleTextareaKeyDown()`, `handleSubmit()`, `handleStopTask()`
- Async functions: `verbObject` or `verb + ObjectNoun` - `fetchMessages()`, `redirectToSignOut()`, `pushChangesToBranch()`
- Getter functions: `get + ObjectNoun` - `getServerSession()`, `getActiveSandboxCount()`, `getAgentInitial()`

**Variables:**
- State variables: `camelCase` - `selectedAgent`, `isSubmitting`, `isSidebarOpen`, `enableBrowser`
- Constants: `UPPER_SNAKE_CASE` - `CODING_AGENTS`, `AGENT_MODELS`, `DEFAULT_MODELS`, `SESSION_COOKIE_NAME`
- Component props interfaces: `ComponentNameProps` - `TaskFormProps`, `AppLayoutProps`, `TaskDetailsProps`
- State setters: `set + PascalCaseVariable` - `setPrompt()`, `setSelectedAgent()`, `setEnableBrowser()`
- Context types: `ComponentNameContextType` - `TasksContextType`

**Types:**
- Interfaces: `PascalCase` - `TaskFormProps`, `Message`, `SandboxConfig`, `SandboxResult`, `AgentExecutionResult`
- Type aliases: `PascalCase` - `User`, `InsertUser`, `Task`, `LogEntry`, `Session`
- Zod schemas: `PascalCase + "Schema"` - `logEntrySchema`, `insertUserSchema`, `selectUserSchema`
- Discriminated union types: use `type` keyword with literal unions - `type: 'info' | 'command' | 'error' | 'success'`

## Code Style

**Formatting:**
- Tool: Prettier (configured in `package.json`)
- Semi-colons: disabled (`semi: false`)
- Quotes: single quotes (`singleQuote: true`)
- Print width: 120 characters (`printWidth: 120`)
- Trailing commas: all (`trailingComma: "all"`)

**Linting:**
- Tool: ESLint 9.39.2 (flat config in `eslint.config.mjs`)
- Config: extends `next/core-web-vitals` and `next/typescript`
- Rules applied:
  - Unused variables allowed with underscore prefix: `@typescript-eslint/no-unused-vars` warns on unused, allows `^_` pattern
  - `@typescript-eslint/no-explicit-any` warns (not enforced as error) - `any` types marked but not blocked

**TypeScript:**
- Strict mode: enabled in `tsconfig.json`
- Target: ES2017
- Module resolution: bundler
- JSX: react-jsx (automatic runtime)
- Path alias: `@/*` maps to project root

## Import Organization

**Order:**
1. React and Next.js imports first
2. Third-party UI library imports (Radix, Lucide icons, etc.)
3. Internal project imports (using `@/` alias)
4. Destructured named imports on same line when possible

**Example pattern from `components/task-form.tsx`:**
```typescript
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ArrowUp, Settings, Cable, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
```

**Path Aliases:**
- Use `@/` prefix for all internal imports (configured in `tsconfig.json`)
- No relative paths (`../`) in source code
- Example: `import { Task } from '@/lib/db/schema'` instead of `import { Task } from '../../../lib/db/schema'`

## Error Handling

**Patterns:**
- Try-catch blocks wrapping async operations and API calls
- Errors logged to console with context: `console.error('Description of action:', error)`
- User-facing errors returned via NextResponse or toast notifications
- Specific HTTP status codes returned: 401 (Unauthorized), 404 (Not Found), 429 (Rate Limited), 500 (Server Error)

**Example from `app/api/tasks/route.ts`:**
```typescript
try {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... operation code
  return NextResponse.json({ tasks: userTasks })
} catch (error) {
  console.error('Error fetching tasks:', error)
  return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
}
```

**Client-side error handling:**
- Toast notifications for user feedback via `sonner` library
- Error caught and logged to console
- State flags for loading/error states: `isSubmitting`, `isStopping`, `isDeleting`

**Example from `components/task-details.tsx`:**
```typescript
try {
  const response = await fetch(`/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stop' }),
  })
  if (response.ok) {
    toast.success('Task stopped')
  } else {
    const error = await response.json()
    toast.error(error.error || 'Failed to stop task')
  }
} catch (error) {
  console.error('Error stopping task:', error)
  toast.error('Failed to stop task')
}
```

**Sensitive data redaction:**
- Logging functions in `lib/utils/logging.ts` automatically redact API keys and tokens
- Pattern: `redactSensitiveInfo()` called in `createLogEntry()`
- Redacted patterns: API keys (sk-ant-, sk-), GitHub tokens (ghp_, gho_, etc.), Bearer tokens, environment variable assignments

## Logging

**Framework:** console (no external logging framework)

**Patterns:**
- Direct console.error() for errors
- Descriptive context messages: `console.error('Error fetching messages:', error)`
- Task-specific logging via `TaskLogger` class: `logger.log()`, `logger.progress()`, `logger.error()`
- Structured log entries stored in database with types: `'info'`, `'command'`, `'error'`, `'success'`

**Example from `lib/utils/logging.ts`:**
```typescript
export function createLogEntry(type: LogEntry['type'], message: string, timestamp?: Date): LogEntry {
  return {
    type,
    message: redactSensitiveInfo(message),
    timestamp: timestamp || new Date(),
  }
}

export function createCommandLog(command: string, args?: string[]): LogEntry {
  const fullCommand = args ? `${command} ${args.join(' ')}` : command
  return createLogEntry('command', `$ ${fullCommand}`)
}
```

## Comments

**When to Comment:**
- Complex business logic or non-obvious algorithms
- Intentional workarounds or temporary solutions
- Critical security or data integrity operations
- Large sections are marked with section comments: `/* Agent Selection */`, `/* Task Options */`, `/* Action Icons */`

**JSDoc/TSDoc:**
- Minimal usage; code is generally self-documenting via strong typing
- Interface properties documented inline: `taskPrompt?: string` - names are descriptive
- Function parameters documented through TypeScript types and interfaces
- No @param/@return style comments unless dealing with complex behavior

## Function Design

**Size:** Prefer functions under 50 lines; larger functions split into helpers
- `handleSubmit()` in `TaskForm`: 18 lines
- `TaskDetails` component: 200+ lines (complex component with multiple concerns, state, effects)
- `createSandbox()` in `lib/sandbox/creation.ts`: 200+ lines (complex multi-step operation)

**Parameters:**
- Use object destructuring for multiple related parameters
- Pattern: single object parameter for related config values
- Example: `SandboxConfig` interface with many optional fields passed to `createSandbox(config)`

**Return Values:**
- Explicitly typed return types on all functions
- Async functions return Promises with typed values
- Success/error patterns use discriminated unions or explicit error fields
- Example from `lib/sandbox/types.ts`:
```typescript
export interface SandboxResult {
  success: boolean
  sandbox?: Sandbox
  domain?: string
  branchName?: string
  error?: string
  cancelled?: boolean
}
```

## Module Design

**Exports:**
- Barrel files (`index.ts`) export public API of modules
- Example: `components/dialogs/index.ts` re-exports dialog components
- Single default exports rare; named exports preferred
- Types exported alongside implementations

**Example from `components/dialogs/index.ts`:**
```typescript
export { ApiKeysDialog } from './api-keys-dialog'
export { ConnectorsDialog } from './connectors-dialog'
export { CreatePRDialog } from './create-pr-dialog'
```

**Barrel Files:**
- Used for component libraries: `components/ui/`, `components/dialogs/`, `components/layout/`
- Used for utilities: `lib/sandbox/agents/`, `lib/atoms/`
- Simplifies imports from directories with multiple related exports
- Import pattern: `import { Component1, Component2 } from '@/components/dialogs'`

---

*Convention analysis: 2026-02-01*
