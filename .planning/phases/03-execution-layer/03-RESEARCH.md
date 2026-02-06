# Phase 3: Execution Layer - Research

**Researched:** 2026-02-01
**Domain:** E2B Sandboxes, OpenCode SDK, Git Operations, VS Code/Terminal, Error Handling
**Confidence:** HIGH

## Summary

This phase implements the core execution infrastructure for autonomous agent work: **E2B sandboxes** for isolated code execution, **OpenCode SDK** for agent runtime with multi-model support, complete **Git workflow** (clone, branch, commit, push, PR), **VS Code/terminal access** via code-server and xterm.js, and robust **error handling** with automatic recovery.

Based on user decisions from CONTEXT.md, the implementation is constrained to:

- **Background execution** with non-blocking UI (Ramp Inspect style)
- **Inline drawer** for VS Code/terminal access (not modal or new tab)
- **Global model preference** with per-session override capability
- **Automatic draft PR** creation on first commit, per-response commits
- **Auto branch creation** per session with timestamp-derived names

**Primary recommendation:** Use E2B `@e2b/code-interpreter` package for sandbox provisioning with auto-pause enabled; OpenCode SDK for agent runtime with dynamic model selection via `session.prompt()`; code-server embedded in iframe for VS Code access; Octokit for GitHub API operations with `octokit-plugin-create-pull-request` for simplified PR creation.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library                                | Version      | Purpose                           | Why Standard                                                  |
| -------------------------------------- | ------------ | --------------------------------- | ------------------------------------------------------------- |
| **@e2b/code-interpreter**              | latest (2.x) | E2B sandbox provisioning          | Official SDK with auto-pause, persistence, ~150ms cold starts |
| **@opencode-ai/sdk**                   | 1.1.23+      | Agent runtime and model selection | Full Build/Plan modes, 75+ providers, type-safe client        |
| **@octokit/rest**                      | 22.0.1       | GitHub API client                 | Official SDK, already in use                                  |
| **octokit-plugin-create-pull-request** | 6.0.1        | Simplified PR creation            | Handles multi-file commits, branch creation                   |
| **code-server**                        | 4.108.1+     | VS Code in browser                | Open source, iframe-embeddable, marketplace compatible        |
| **@xterm/xterm**                       | 5.3.0+       | Terminal emulator                 | Industry standard, WebSocket-ready                            |

### Supporting

| Library                   | Version | Purpose                    | When to Use                              |
| ------------------------- | ------- | -------------------------- | ---------------------------------------- |
| **xterm-addon-fit**       | 0.8.0   | Responsive terminal sizing | For terminal that resizes with container |
| **xterm-addon-web-links** | 0.9.0   | Clickable URLs in terminal | When terminal shows URLs                 |
| **simple-git**            | 3.22.0+ | Git operations in sandbox  | Alternative to raw git CLI commands      |

### Alternatives Considered

| Instead of                         | Could Use                 | Tradeoff                                                 |
| ---------------------------------- | ------------------------- | -------------------------------------------------------- |
| E2B code-interpreter               | Raw E2B SDK               | Code-interpreter is higher-level with better defaults    |
| code-server                        | VS Code Server (official) | code-server more flexible, works without MS account      |
| octokit-plugin-create-pull-request | Manual Octokit calls      | Plugin handles edge cases (large files, base64 encoding) |

**Installation:**

```bash
# E2B SDK
npm install @e2b/code-interpreter

# OpenCode SDK
npm install @opencode-ai/sdk

# GitHub API
npm install @octokit/rest octokit-plugin-create-pull-request

# Terminal
npm install @xterm/xterm xterm-addon-fit

# code-server is installed via npm globally in sandbox
npm install -g code-server
```

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
├── lib/
│   ├── e2b.ts              # E2B sandbox management
│   ├── opencode.ts         # OpenCode client with model selection
│   ├── github.ts           # Octokit client for Git operations
│   └── git-workflow.ts     # Branch/PR automation logic
├── durable-objects/
│   └── session.ts          # DO with sandbox lifecycle management
└── routes/
    ├── sandbox.ts          # Sandbox provisioning API
    ├── git.ts              # Git operations API
    └── models.ts           # Available models API

apps/web/components/
├── sandbox/
│   ├── vscode-drawer.tsx   # Inline VS Code drawer
│   └── terminal-drawer.tsx # Inline terminal drawer
├── git/
│   ├── pr-panel.tsx        # PR creation/status UI
│   └── branch-selector.tsx # Branch name display
└── model/
    └── model-selector.tsx  # Model selection dropdown
```

### Pattern 1: E2B Sandbox Lifecycle Management

**What:** Create sandbox on session creation, auto-pause on idle, resume on reconnect
**When to use:** Standard pattern for all sessions with long-running agents
**Example:**

```typescript
// Source: E2B docs (https://e2b.dev/docs/sandbox)
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with auto-pause (beta) - aligns with 5-min idle timeout decision
export async function createSessionSandbox(sessionId: string) {
  const sandbox = await Sandbox.betaCreate({
    autoPause: true, // Auto-pause after timeout
    timeoutMs: 5 * 60 * 1000, // 5 minutes default
    metadata: { sessionId },
  })

  return {
    sandboxId: sandbox.sandboxId,
    // Store for resumption
    persist: async () => {
      await sandbox.betaPause()
      return sandbox.sandboxId
    },
    resume: async (id: string) => {
      return await Sandbox.connect(id, {
        timeoutMs: 5 * 60 * 1000,
      })
    },
  }
}
```

### Pattern 2: OpenCode Model Selection

**What:** Support all OpenCode-supported models with global default + per-session override
**When to use:** Per CONTEXT.md decisions - global preference with session override
**Example:**

```typescript
// Source: OpenCode SDK docs (https://opencode.ai/docs/sdk/)
import { createOpencode } from '@opencode-ai/sdk'

// Client with model selection capability
export async function createOpenCodeClient(options: {
  defaultModel?: string // Global user preference
  sessionModel?: string // Per-session override
}) {
  const model = options.sessionModel || options.defaultModel || 'anthropic/claude-sonnet-4-20250514'

  const opencode = await createOpencode({
    hostname: '127.0.0.1',
    port: 4096,
    config: {
      model, // Set selected model
    },
  })

  return opencode
}

// Switch models mid-session (NOT while generating per decision)
export async function switchModel(
  opencode: Awaited<ReturnType<typeof createOpencode>>,
  sessionId: string,
  newModel: string,
  isGenerating: boolean,
) {
  if (isGenerating) {
    throw new Error('Cannot switch model while agent is generating')
  }

  // Update via session.update or use in next prompt
  await opencode.client.session.update({
    path: { id: sessionId },
    body: { model: newModel },
  })
}

// Get available models (query OpenCode API)
export async function getAvailableModels(opencode: Awaited<ReturnType<typeof createOpencode>>) {
  const { providers, default: defaults } = await opencode.client.config.providers()

  // Flatten all available models
  return providers.flatMap(
    (provider) =>
      provider.models?.map((model) => ({
        id: `${provider.id}/${model.id}`,
        name: model.name,
        provider: provider.name,
        defaultVariant: defaults[provider.id],
      })) || [],
  )
}
```

### Pattern 3: Git Workflow Automation

**What:** Auto-create branch per session, auto-draft PR on first commit, per-response commits
**When to use:** Per CONTEXT.md locked decisions
**Example:**

```typescript
// Source: octokit-plugin-create-pull-request docs + GitHub API
import { Octokit } from '@octokit/rest'
import { createPullRequest } from 'octokit-plugin-create-pull-request'

const MyOctokit = Octokit.plugin(createPullRequest)

export class GitWorkflow {
  private octokit: InstanceType<typeof MyOctokit>

  constructor(token: string) {
    this.octokit = new MyOctokit({ auth: token })
  }

  // Generate branch name from task description + timestamp
  generateBranchName(description: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const slug = description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 30)
    return `ship-${slug}-${timestamp}`
  }

  // Clone repo (run in sandbox)
  async cloneRepo(sandbox: Sandbox, repoUrl: string, branch: string) {
    await sandbox.commands.run(`git clone ${repoUrl} /home/user/repo`)
    await sandbox.commands.run(`cd /home/user/repo && git checkout -b ${branch}`)
  }

  // Commit changes (called per AI response as per decision)
  async commit(sandbox: Sandbox, message: string, user: GitUser) {
    await sandbox.commands.run(`
      cd /home/user/repo && \
      git config user.name "${user.name}" && \
      git config user.email "${user.email}" && \
      git add -A && \
      git commit -m "${message}"
    `)
  }

  // Push to remote
  async push(sandbox: Sandbox, branch: string, token: string) {
    // Use token in URL for authentication
    await sandbox.commands.run(`
      cd /home/user/repo && \
      git push origin ${branch}
    `)
  }

  // Create draft PR (auto-created on first commit per decision)
  async createDraftPR(params: {
    owner: string
    repo: string
    title: string
    body: string
    head: string
    base?: string
    draft?: boolean
  }) {
    const { data: pr } = await this.octokit.pulls.create({
      owner: params.owner,
      repo: params.repo,
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base || 'main',
      draft: params.draft ?? true, // Default to draft per decision
    })

    return pr
  }

  // Mark PR ready for review (user action)
  async markReadyForReview(prNumber: number, owner: string, repo: string) {
    await this.octokit.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      draft: false,
    })
  }
}
```

### Pattern 4: VS Code Server Embedding

**What:** Embed code-server in inline drawer via iframe
**When to use:** Per CONTEXT.md - inline drawer, not modal/new tab
**Example:**

```typescript
// Source: code-server docs + iframe patterns
// apps/web/components/sandbox/vscode-drawer.tsx
'use client';

import { useState } from 'react';
import { Drawer } from '@/components/ui/drawer';  // shadcn/ui or vaul

interface VSCodeDrawerProps {
  sandboxId: string;
  e2bDomain: string;  // E2B provides domain for sandbox access
}

export function VSCodeDrawer({ sandboxId, e2bDomain }: VSCodeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // code-server runs on port 8080 in sandbox
  const codeServerUrl = `https://${sandboxId}.${e2bDomain}:8080`;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-muted rounded-md"
        title="Open VS Code"
      >
        <CodeIcon className="h-4 w-4" />
      </button>

      <Drawer open={isOpen} onOpenChange={setIsOpen} direction="right">
        <Drawer.Content className="w-[800px] h-full right-0">
          <Drawer.Header>
            <Drawer.Title>VS Code</Drawer.Title>
          </Drawer.Header>
          <div className="flex-1 h-[calc(100vh-60px)]">
            <iframe
              src={codeServerUrl}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="clipboard-read; clipboard-write"
              title="VS Code Server"
            />
          </div>
        </Drawer.Content>
      </Drawer>
    </>
  );
}
```

### Pattern 5: Terminal Access via xterm.js

**What:** WebSocket-connected terminal in inline drawer
**When to use:** Per CONTEXT.md - terminal access alongside VS Code
**Example:**

```typescript
// Source: xterm.js docs + E2B command streaming
// apps/web/components/sandbox/terminal-drawer.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalDrawerProps {
  sandboxId: string;
  // WebSocket URL for terminal (E2B or custom)
  wsUrl: string;
}

export function TerminalDrawer({ sandboxId, wsUrl }: TerminalDrawerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal>();
  const fitAddon = useRef<FitAddon>();
  const ws = useRef<WebSocket>();

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      }
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Connect WebSocket for shell access
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      terminal.current?.writeln('Connected to sandbox terminal');
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.output) {
        terminal.current?.write(data.output);
      }
    };

    // Send input to sandbox
    terminal.current.onData((data) => {
      ws.current?.send(JSON.stringify({ input: data }));
    });

    return () => {
      terminal.current?.dispose();
      ws.current?.close();
    };
  }, [wsUrl]);

  return (
    <Drawer direction="bottom">
      <Drawer.Content className="h-[300px]">
        <div ref={terminalRef} className="h-full w-full" />
      </Drawer.Content>
    </Drawer>
  );
}
```

### Pattern 6: Error Classification and Recovery

**What:** Classify errors as transient (retry) vs persistent (notify), with graceful degradation
**When to use:** Per CONTEXT.md - automatic retry for transient, pause for persistent
**Example:**

```typescript
// Error classification for agent task execution
export type ErrorCategory =
  | 'transient' // Network, rate limit, temporary failure - auto-retry
  | 'persistent' // Auth, permission, logic error - pause & notify
  | 'fatal' // Unrecoverable - abort task
  | 'user-action' // Needs user decision - prompt via UI

interface ErrorDetails {
  category: ErrorCategory
  retryable: boolean
  maxRetries: number
  backoffMs: number
}

// Error classifier (Claude's discretion per CONTEXT.md)
export function classifyError(error: unknown): ErrorDetails {
  const message = error instanceof Error ? error.message : String(error)

  // Transient errors - network, timeouts, rate limits
  if (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('temporary') ||
    message.includes('timeout')
  ) {
    return {
      category: 'transient',
      retryable: true,
      maxRetries: 3,
      backoffMs: 2000, // 2s, 4s, 8s exponential
    }
  }

  // User-action errors - permissions, confirmations
  if (message.includes('permission') || message.includes('unauthorized') || message.includes('confirm')) {
    return {
      category: 'user-action',
      retryable: false,
      maxRetries: 0,
      backoffMs: 0,
    }
  }

  // Persistent errors - logic, auth failures
  if (message.includes('authentication') || message.includes('not found') || message.includes('invalid')) {
    return {
      category: 'persistent',
      retryable: false,
      maxRetries: 0,
      backoffMs: 0,
    }
  }

  // Default to fatal
  return {
    category: 'fatal',
    retryable: false,
    maxRetries: 0,
    backoffMs: 0,
  }
}

// Retry wrapper with backoff
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  context: { operationName: string; onError?: (error: Error, attempt: number) => void },
): Promise<T> {
  let lastError: Error

  try {
    return await operation()
  } catch (error) {
    const details = classifyError(error)
    lastError = error instanceof Error ? error : new Error(String(error))

    if (!details.retryable) {
      throw lastError
    }

    // Retry with exponential backoff
    for (let attempt = 1; attempt <= details.maxRetries; attempt++) {
      const delay = details.backoffMs * Math.pow(2, attempt - 1)
      await sleep(delay)

      try {
        return await operation()
      } catch (retryError) {
        lastError = retryError instanceof Error ? retryError : new Error(String(retryError))
        context.onError?.(lastError, attempt)
      }
    }

    throw lastError
  }
}
```

### Anti-Patterns to Avoid

- **Running code-server on port 80/443 without auth:** Always use authentication token
- **Storing GitHub tokens in sandbox:** Pass per-operation, use short-lived tokens
- **Creating PR without checking for existing:** Check for existing PR on same branch
- **Infinite retry loops:** Always cap retries, use exponential backoff with jitter
- **Not handling E2B sandbox expiration:** Always set timeout, handle `betaPause()` for idle

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                    | Don't Build                              | Use Instead                                      | Why                                                         |
| -------------------------- | ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Sandbox provisioning       | Docker-in-Docker or VM management        | E2B SDK                                          | Firecracker microVMs, ~150ms cold starts, managed lifecycle |
| Multi-file PR creation     | Manual blob/tree/commit creation         | octokit-plugin-create-pull-request               | Handles edge cases, encoding, large files                   |
| Git operations in sandbox  | Shell commands with string concatenation | simple-git or structured commands                | Type safety, better error handling                          |
| Terminal emulation         | Custom canvas/WebGL terminal             | xterm.js                                         | Battle-tested, WebSocket-ready, addons ecosystem            |
| Model provider abstraction | Custom API wrappers for each LLM         | OpenCode SDK                                     | 75+ providers, unified interface, tool calling              |
| Error retry logic          | Simple for-loop with fixed delay         | Exponential backoff with jitter + classification | Prevents thundering herd, handles different error types     |
| VS Code embedding          | Monaco Editor + custom file tree         | code-server                                      | Full VS Code experience, extensions, debugging              |

**Key insight:** E2B + OpenCode + code-server is the industry-standard stack for browser-based agent coding. Don't rebuild the infrastructure layer.

## Common Pitfalls

### Pitfall 1: Sandbox Timeout Without Persistence

**What goes wrong:** Sandbox killed while agent is still working, losing all progress
**Why it happens:** Default 5-minute timeout insufficient for long tasks
**How to avoid:** Use `betaPause()` for idle sessions, `setTimeout()` during active work, auto-pause enabled
**Warning signs:** Agent suddenly stops responding mid-task

### Pitfall 2: Git Auth Failures in Sandbox

**What goes wrong:** Git push fails because token not passed correctly to sandbox
**Why it happens:** GitHub tokens need to be in remote URL or credential helper
**How to avoid:** Use token in clone URL: `https://token@github.com/owner/repo.git`
**Warning signs:** "Authentication failed" errors during push

### Pitfall 3: OpenCode Model Not Available

**What goes wrong:** Selected model throws error because provider not configured
**Why it happens:** OpenCode supports 75+ models but requires provider credentials
**How to avoid:** Query `config.providers()` to show only configured models, validate before use
**Warning signs:** "Provider not found" or "API key not set" errors

### Pitfall 4: WebSocket Reconnection Flooding

**What goes wrong:** Terminal reconnects too aggressively after disconnect
**Why it happens:** Fixed retry intervals without backoff
**How to avoid:** Exponential backoff with jitter (100ms, 200ms, 400ms...)
**Warning signs:** Server logs show rapid reconnection attempts

### Pitfall 5: PR Already Exists on Branch

**What goes wrong:** Creating PR fails because one already exists for the branch
**Why it happens:** Auto-create PR on first commit doesn't check for existing
**How to avoid:** Check `octokit.pulls.list()` for head branch before creating
**Warning signs:** "A pull request already exists" API error

### Pitfall 6: code-server iframe CSP Issues

**What goes wrong:** code-server won't load in iframe due to Content Security Policy
**Why it happens:** code-server has `X-Frame-Options` or CSP headers blocking embedding
**How to avoid:** Configure code-server with `--auth none` and custom headers in E2B template
**Warning signs:** Blank iframe, "refused to connect" errors

### Pitfall 7: Branch Name Collisions

**What goes wrong:** Branch creation fails because name already exists
**Why it happens:** Timestamp collision or repeated task descriptions
**How to avoid:** Include session ID in branch name, check existence before create
**Warning signs:** "Reference already exists" git error

## Code Examples

### E2B Sandbox with Code-Server Setup

```typescript
// Source: E2B docs + code-server setup
import { Sandbox } from '@e2b/code-interpreter'

export async function setupDevSandbox(sessionId: string, repoUrl: string) {
  // Create sandbox with extended timeout for development
  const sandbox = await Sandbox.betaCreate({
    autoPause: true,
    timeoutMs: 10 * 60 * 1000, // 10 minutes
    metadata: { sessionId, type: 'dev' },
  })

  // Clone repository
  await sandbox.commands.run(`git clone ${repoUrl} /home/user/project`)

  // Install and start code-server
  await sandbox.commands.run(`
    npm install -g code-server && \
    code-server --install-extension esbenp.prettier-vscode
  `)

  // Start code-server in background (no auth for iframe embedding)
  await sandbox.commands.run(`
    code-server /home/user/project \
      --bind-addr 0.0.0.0:8080 \
      --auth none \
      --disable-telemetry &
  `)

  return sandbox
}
```

### Model Selection with Validation

```typescript
// Source: OpenCode SDK docs
import { createOpencodeClient } from '@opencode-ai/sdk'

export async function selectModelWithValidation(baseUrl: string, requestedModel: string) {
  const client = createOpencodeClient({ baseUrl })

  // Get available providers
  const { providers } = await client.config.providers()

  // Check if requested model is available
  const [providerId, modelId] = requestedModel.split('/')
  const provider = providers.find((p) => p.id === providerId)

  if (!provider) {
    const available = providers.map((p) => p.id).join(', ')
    throw new Error(`Provider '${providerId}' not configured. ` + `Available: ${available}`)
  }

  const model = provider.models?.find((m) => m.id === modelId)
  if (!model) {
    const available = provider.models?.map((m) => m.id).join(', ')
    throw new Error(`Model '${modelId}' not available for provider '${providerId}'. ` + `Available: ${available}`)
  }

  return { provider, model, fullId: requestedModel }
}
```

### Complete Git Workflow

```typescript
// Git workflow for autonomous agent
export async function executeGitWorkflow(
  sandbox: Sandbox,
  octokit: Octokit,
  params: {
    owner: string
    repo: string
    taskDescription: string
    user: { name: string; email: string; token: string }
    changes: Array<{ path: string; content: string }>
  },
) {
  const branchName = generateBranchName(params.taskDescription)

  // 1. Clone with token
  const cloneUrl = `https://${params.user.token}@github.com/${params.owner}/${params.repo}.git`
  await sandbox.commands.run(`git clone ${cloneUrl} /home/user/repo`)

  // 2. Create branch
  await sandbox.commands.run(`
    cd /home/user/repo && \
    git checkout -b ${branchName}
  `)

  // 3. Apply changes
  for (const change of params.changes) {
    await sandbox.filesystem.write(`/home/user/repo/${change.path}`, change.content)
  }

  // 4. Configure git user (per decision: attribution as user)
  await sandbox.commands.run(`
    cd /home/user/repo && \
    git config user.name "${params.user.name}" && \
    git config user.email "${params.user.email}"
  `)

  // 5. Commit (per-response commits per decision)
  await sandbox.commands.run(`
    cd /home/user/repo && \
    git add -A && \
    git commit -m "${params.taskDescription}"
  `)

  // 6. Push
  await sandbox.commands.run(`cd /home/user/repo && git push origin ${branchName}`)

  // 7. Create draft PR (auto on first commit per decision)
  const pr = await octokit.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.taskDescription,
    body: `Draft PR for: ${params.taskDescription}\n\nShip session automated PR`,
    head: branchName,
    base: 'main',
    draft: true,
  })

  return { branchName, prNumber: pr.data.number, prUrl: pr.data.html_url }
}
```

### Error Display in Chat

```typescript
// Source: CONTEXT.md - inline system message for errors
interface ErrorMessage {
  type: 'error';
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  actions?: Array<{
    type: 'retry' | 'open-vscode' | 'open-terminal';
    label: string;
  }>;
}

export function renderErrorMessage(error: ErrorMessage) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-destructive">
            {error.category === 'transient' ? 'Temporary Error' : 'Error'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message}
          </p>

          {error.actions && (
            <div className="flex gap-2 mt-3">
              {error.actions.map(action => (
                <button
                  key={action.type}
                  className="text-xs px-2 py-1 rounded bg-background border"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach        | Current Approach                     | When Changed | Impact                                |
| ------------------- | ------------------------------------ | ------------ | ------------------------------------- |
| Modal sandboxes     | E2B Firecracker microVMs             | 2024-2025    | ~150ms cold starts, TypeScript-native |
| Single-model agents | Multi-model with selection           | 2025         | OpenCode supports 75+ providers       |
| Manual GitHub API   | octokit-plugin-create-pull-request   | 2023         | Simplified multi-file PRs             |
| Monaco-only editors | Full code-server VS Code             | 2024         | Extensions, debugging, full IDE       |
| Custom terminals    | xterm.js standard                    | 2020+        | WebSocket-ready, battle-tested        |
| Fixed retry delays  | Exponential backoff + classification | 2025         | Smarter error recovery                |

**Deprecated/outdated:**

- `@e2b/sdk` (old package): Renamed to `e2b` and now `@e2b/code-interpreter`
- Custom VM management: Use E2B instead
- Direct LLM API calls: Use OpenCode SDK for agent features

## Open Questions

Things that couldn't be fully resolved:

1. **Sandbox warming strategy**
   - What we know: CONTEXT.md marks this as Claude's discretion
   - What's unclear: Pre-warm pool vs on-demand tradeoffs for Ship's use case
   - Recommendation: Start on-demand with auto-pause; add warming if session creation latency becomes issue

2. **Exact E2B pricing for auto-pause**
   - What we know: Auto-pause is in beta, free during beta
   - What's unclear: Exact pricing when beta ends
   - Recommendation: Build with auto-pause, monitor costs, adjust idle timeout (5min default) based on usage

3. **OpenCode server deployment pattern**
   - What we know: SDK can auto-start server or connect to existing
   - What's unclear: Best pattern for production Cloudflare Workers
   - Recommendation: Use client-only mode connecting to dedicated OpenCode service; auto-start for dev only

4. **Terminal WebSocket implementation**
   - What we know: xterm.js needs WebSocket for shell access
   - What's unclear: Whether E2B provides shell WebSocket directly
   - Recommendation: Use E2B `commands.run()` streaming for MVP; custom WebSocket if needed for real-time

5. **code-server template customization**
   - What we know: Can install code-server in sandbox
   - What's unclear: Best approach for pre-built templates with code-server
   - Recommendation: Start with runtime installation, move to custom E2B template for faster startup

## Sources

### Primary (HIGH confidence)

- [E2B Documentation](https://e2b.dev/docs) - Sandbox lifecycle, commands, persistence
- [E2B Sandbox Persistence](https://e2b.dev/docs/sandbox/persistence) - betaPause, auto-pause
- [OpenCode SDK Documentation](https://opencode.ai/docs/sdk/) - Session API, events, model selection
- [OpenCode Models](https://opencode.ai/docs/models/) - 75+ providers, model configuration
- [Octokit REST.js](https://github.com/octokit/rest.js) - GitHub API client
- [octokit-plugin-create-pull-request](https://github.com/gr2m/octokit-plugin-create-pull-request) - PR creation
- [code-server Documentation](https://coder.com/docs/code-server) - VS Code in browser
- [xterm.js Documentation](https://xtermjs.org/) - Terminal emulator

### Secondary (MEDIUM confidence)

- [Agent Error Recovery Patterns](https://www.arunbaby.com/ai-agents/0033-error-handling-recovery/) - Error classification strategies
- [Error Handling in Agentic Systems](https://agentsarcade.com/blog/error-handling-agentic-systems-retries-rollbacks-graceful-failure) - Retry patterns
- [WebSocket Reconnection](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1) - Backoff with jitter
- [GitHub API PR Creation](https://docs.github.com/en/rest/pulls/pulls) - REST API reference

### Tertiary (LOW confidence)

- Community patterns for sandbox IDE embedding (implemented based on iframe best practices)
- Error classification heuristics (derived from common error patterns)

## Metadata

**Confidence breakdown:**

- E2B sandbox: HIGH - Official docs, stable API
- OpenCode SDK: HIGH - Official docs, actively maintained
- Git operations: HIGH - Official Octokit docs, established patterns
- VS Code/terminal: HIGH - Established libraries with clear usage
- Error handling: MEDIUM - Based on patterns, not official frameworks

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - E2B auto-pause beta may change)
