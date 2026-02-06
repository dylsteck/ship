# Phase 4: Real-Time UI & Visibility - Research

**Researched:** 2026-02-01
**Domain:** Real-time UI updates, code viewers, terminal viewers, Git diffs, cost tracking
**Confidence:** HIGH

## Summary

Phase 4 enhances the existing chat interface and adds real-time visibility into agent work. The codebase already has foundational pieces: WebSocket infrastructure (Phase 2), terminal viewer with xterm.js (Phase 3), and chat streaming (Phase 2). This phase focuses on polishing the UI to match Ramp Inspect design, adding code change viewers, Git diff visualization, and cost tracking.

The standard stack leverages existing libraries: Monaco Editor for code viewing (already in stack), xterm.js for terminal (already implemented), and @git-diff-view/react for diff visualization (already in package.json). Real-time updates flow through existing WebSocket infrastructure. Cost tracking requires aggregating token usage from OpenCode SDK events.

**Primary recommendation:** Use Monaco Editor for code viewer (already in stack), enhance existing xterm.js terminal viewer, use @git-diff-view/react for Git diffs (already in stack), track costs from OpenCode SDK tool-call events, polish chat UI to match Ramp Inspect design patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @monaco-editor/react | 4.7.0 | Code viewer/editor | Already in stack, VS Code editor in browser |
| @xterm/xterm | 5.3.0+ | Terminal emulator | Already implemented in Phase 3 |
| @git-diff-view/react | 0.0.32 | Git diff visualization | Already in package.json, React component |
| @git-diff-view/file | 0.0.32 | Git diff file parsing | Companion to react component |
| WebSocket (native) | - | Real-time updates | Already implemented in Phase 2 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xterm-addon-fit | 0.8.0 | Terminal responsive sizing | Already in use for terminal drawer |
| xterm-addon-web-links | 0.9.0 | Clickable URLs in terminal | Already in use |
| sonner | 2.0.7 | Toast notifications | Already in stack for cost display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Monaco Editor | CodeMirror 6 | Monaco is VS Code editor, better syntax highlighting, already in stack |
| @git-diff-view/react | react-diff-view | git-diff-view already in package.json, lighter weight |
| WebSocket | Server-Sent Events | WebSocket already implemented, better for bidirectional updates |

**Installation:**
```bash
# Already installed:
# @monaco-editor/react 4.7.0
# @xterm/xterm 5.3.0
# @git-diff-view/react 0.0.32
# @git-diff-view/file 0.0.32

# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── components/
│   ├── chat/
│   │   ├── chat-interface.tsx      # Enhanced with Ramp design
│   │   ├── message-list.tsx         # Already exists, enhance styling
│   │   ├── tool-block.tsx          # Already exists, add code viewer
│   │   └── chat-input.tsx           # Already exists, polish design
│   ├── code/
│   │   └── code-viewer.tsx         # NEW: Monaco-based code viewer
│   ├── diff/
│   │   └── diff-viewer.tsx          # NEW: Git diff viewer component
│   ├── session/
│   │   ├── session-list.tsx        # Already exists, enhance design
│   │   ├── session-panel.tsx       # Already exists, add cost display
│   │   └── status-indicator.tsx    # Already exists, enhance real-time updates
│   └── cost/
│       └── cost-breakdown.tsx      # NEW: Cost per task display
└── lib/
    ├── websocket.ts                # Already exists, no changes
    └── cost-tracker.ts             # NEW: Aggregate costs from events
```

### Pattern 1: Code Viewer with Monaco Editor
**What:** Display code changes in real-time as agent makes edits
**When to use:** When agent modifies files, show diff or full file
**Example:**
```typescript
// apps/web/components/code/code-viewer.tsx
'use client';

import { Editor } from '@monaco-editor/react';
import { useMemo } from 'react';

interface CodeViewerProps {
  filePath: string;
  content: string;
  language?: string;
  readOnly?: boolean;
}

export function CodeViewer({ filePath, content, language, readOnly = true }: CodeViewerProps) {
  const detectedLanguage = useMemo(() => {
    if (language) return language;
    // Auto-detect from file extension
    const ext = filePath.split('.').pop();
    return ext === 'ts' ? 'typescript' : ext === 'tsx' ? 'typescript' : 'plaintext';
  }, [filePath, language]);

  return (
    <Editor
      height="400px"
      language={detectedLanguage}
      value={content}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
      }}
    />
  );
}
```

### Pattern 2: Git Diff Viewer
**What:** Display Git diffs showing what changed in codebase
**When to use:** After agent commits, show diff before PR creation
**Example:**
```typescript
// apps/web/components/diff/diff-viewer.tsx
'use client';

import { DiffView, DiffViewerOptions } from '@git-diff-view/react';
import { FileData } from '@git-diff-view/file';

interface DiffViewerProps {
  diff: string; // Git diff output
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const files = useMemo(() => {
    // Parse diff string into FileData[]
    return parseDiff(diff);
  }, [diff]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {files.map((file) => (
        <DiffView
          key={file.fileName}
          diff={file}
          options={{
            highlight: true,
            showHeader: true,
          }}
        />
      ))}
    </div>
  );
}
```

### Pattern 3: Real-Time Status Indicators
**What:** Show agent's current state (planning, executing, stuck) via WebSocket
**When to use:** Always visible in session UI, updates from WebSocket events
**Example:**
```typescript
// Already exists in status-indicator.tsx, enhance with more states
// WebSocket event: { type: 'agent-status', status: 'planning' | 'executing' | 'stuck' | 'idle' }
// Display with animated indicators matching Ramp design
```

### Pattern 4: Cost Tracking
**What:** Aggregate token usage from OpenCode SDK tool-call events
**When to use:** After each task completes, show cost breakdown
**Example:**
```typescript
// apps/web/lib/cost-tracker.ts
export interface CostBreakdown {
  taskId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // USD
  model: string;
}

// Aggregate from SSE events:
// { type: 'tool-call', toolName: '...', tokens: { input, output }, model: '...' }
// Calculate cost based on model pricing (Claude Sonnet: $3/$15 per 1M tokens)
```

### Pattern 5: Enhanced Chat Interface (Ramp Inspect Style)
**What:** Clean layout with visual polish matching Ramp Inspect
**When to use:** Main chat interface in session page
**Key design elements:**
- Clean message bubbles with subtle shadows
- Tool call blocks with collapsible sections
- Inline code viewer for file changes
- Smooth scrolling and loading states
- Status indicators in header

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code syntax highlighting | Custom regex parser | Monaco Editor | Full language support, themes, performance |
| Git diff parsing | Manual diff parsing | @git-diff-view/file | Handles edge cases, binary files, renames |
| Terminal emulator | Canvas-based terminal | xterm.js | ANSI support, performance, accessibility |
| Cost calculation | Manual token counting | Aggregate from SDK events | SDK already tracks usage accurately |

**Key insight:** All required libraries already exist in the stack. Focus on integration and UI polish, not building new viewers.

## Common Pitfalls

### Pitfall 1: Over-Engineering Code Viewer
**What goes wrong:** Building custom code viewer instead of using Monaco
**Why it happens:** Thinking Monaco is "too heavy" or wanting custom features
**How to avoid:** Use Monaco Editor - it's already in stack, handles all languages, themes, and performance
**Warning signs:** "Let's build a simple code viewer" or "Monaco is overkill"

### Pitfall 2: Not Tracking Costs Incrementally
**What goes wrong:** Trying to calculate costs at end instead of aggregating during execution
**Why it happens:** Cost data not available until task completes
**How to avoid:** Track costs from each tool-call event, aggregate in real-time
**Warning signs:** "We'll calculate cost when task finishes"

### Pitfall 3: WebSocket Event Overload
**What goes wrong:** Sending too many small updates, causing UI jank
**Why it happens:** Updating UI on every character change or small event
**How to avoid:** Batch updates, debounce rapid changes, use React state batching
**Warning signs:** UI freezes during agent execution

### Pitfall 4: Ignoring Existing Infrastructure
**What goes wrong:** Building new WebSocket client instead of using existing one
**Why it happens:** Not realizing Phase 2 already implemented WebSocket
**How to avoid:** Review existing websocket.ts and chat-interface.tsx before building
**Warning signs:** "We need to add WebSocket support"

## Code Examples

Verified patterns from existing codebase:

### Real-Time Updates via WebSocket
```typescript
// Already implemented in chat-interface.tsx
// Pattern: WebSocket receives events, updates React state
wsRef.current = createReconnectingWebSocket({
  url: wsUrl,
  onMessage: (data) => {
    if (data.type === 'agent-status') {
      onStatusChange?.(data.status, data.details);
    }
  },
});
```

### Terminal Viewer Integration
```typescript
// Already implemented in terminal-drawer.tsx
// Pattern: xterm.js with FitAddon, WebSocket for shell access
const terminal = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  theme: { background: '#1e1e1e', foreground: '#d4d4d4' }
});
```

### Streaming Message Updates
```typescript
// Already implemented in chat-interface.tsx
// Pattern: SSE stream updates message parts in real-time
if (data.type === 'assistant') {
  setMessages((prev) =>
    prev.map((m) => m.id === streamingMessageRef.current 
      ? { ...m, content: data.content } 
      : m
    )
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom code viewer | Monaco Editor | Already in stack | Better syntax highlighting, themes |
| Manual diff parsing | @git-diff-view | Already in stack | Handles edge cases, better UX |
| Polling for updates | WebSocket real-time | Phase 2 | Instant updates, lower latency |

**Deprecated/outdated:**
- None - all libraries are current and actively maintained

## Open Questions

1. **Ramp Inspect Design Reference**
   - What we know: Need to match Ramp Inspect UI design
   - What's unclear: Specific design tokens, spacing, colors
   - Recommendation: Review Ramp Inspect UI screenshots, extract design patterns

2. **Cost Calculation Precision**
   - What we know: OpenCode SDK provides token counts
   - What's unclear: Exact pricing per model (may vary by provider)
   - Recommendation: Use approximate pricing, allow configuration

## Sources

### Primary (HIGH confidence)
- Existing codebase: chat-interface.tsx, terminal-drawer.tsx, websocket.ts
- Package.json: @monaco-editor/react, @xterm/xterm, @git-diff-view/react already installed
- Phase 2 research: WebSocket infrastructure documented
- Phase 3 research: Terminal viewer implementation documented

### Secondary (MEDIUM confidence)
- Monaco Editor docs: Standard React integration patterns
- xterm.js docs: Already implemented, patterns verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Patterns already established in codebase
- Pitfalls: MEDIUM - Based on common React/real-time UI patterns

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain)
