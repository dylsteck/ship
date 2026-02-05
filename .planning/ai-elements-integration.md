# AI Elements Integration - Implementation Documentation

**Date**: 2025-02-05  
**Project**: Ship  
**Scope**: Chat UI Refactor with Vercel AI Elements

## Overview

Replaced the current chat UI with custom AI Elements components for a cleaner, more polished conversation experience. Also removed the dotted background pattern in favor of a clean white look.

## Implementation Summary

### Components Created

#### 1. AI Elements (packages/ui/src/ai-elements/)

Custom implementation of Vercel AI Elements-style components using base-ui and shadcn/ui patterns:

- **message.tsx** - Avatar-based message layout with user/assistant roles
- **reasoning.tsx** - Collapsible reasoning display with streaming state
- **chain-of-thought.tsx** - Step-by-step progress visualization
- **tool.tsx** - Tool call/result display with expandable details
- **prompt-input.tsx** - Chat input with submit handling
- **shimmer.tsx** - Streaming text animation
- **code-block.tsx** - Syntax-highlighted code with copy button
- **response.tsx** - Message content wrapper
- **loader.tsx** - Loading states with progress bars
- **task.tsx** - Task/todo item display
- **conversation.tsx** - Message thread wrapper

#### 2. Adapter Layer (apps/web/lib/ai-elements-adapter.ts)

Transforms OpenCode SSE event data into AI Elements format:

```typescript
- adaptToolPart(sseToolPart) → AI Elements Tool props
- adaptReasoningPart(sseReasoningPart) → AI Elements Reasoning props
- buildChainOfThoughtSteps(tools, reasoning) → ChainOfThought steps
- adaptMessageForDisplay(message, parts) → Complete message adaptation
```

#### 3. Chat Components (apps/web/components/chat/)

- **ai-message-list.tsx** - Main message display using AI Elements
- **enhanced-prompt-input.tsx** - Input with build/plan mode toggle

#### 4. Session Sidebar (apps/web/components/chat/session-sidebar.tsx)

Redesigned right sidebar using shadcn Sidebar components:

- Slimmer design (w-72)
- SidebarGroup/SidebarGroupLabel/SidebarGroupContent structure
- AI Elements Task component for todos
- AI Elements Loader for sandbox states

### Files Modified

#### packages/ui/src/index.ts

- Added AI Elements exports

#### apps/web/components/chat/chat-interface.tsx

- Replaced MessageList, ChatInput with AIMessageList, EnhancedPromptInput
- Added AI Elements state management (streamingText, currentReasoning, currentSteps)
- Removed ThinkingIndicator and ActivityFeed references
- Updated SSE event handling to populate AI Elements state

#### apps/web/components/chat/markdown.tsx

- Replaced custom code block rendering with AI Elements CodeBlock
- Inline code stays unchanged

#### apps/web/app/(app)/session/[id]/page-client.tsx

- Removed DashboardBackground import and usage
- Changed backgrounds to clean white (bg-white dark:bg-background)
- Replaced SessionPanel with SessionSidebar

### Files Deleted

- `apps/web/components/dashboard-background.tsx`
- `apps/web/components/chat/message-list.tsx`
- `apps/web/components/chat/thinking-indicator.tsx`
- `apps/web/components/chat/activity-feed.tsx`
- `apps/web/components/chat/tool-card.tsx`
- `apps/web/components/chat/tool-block.tsx`
- `apps/web/components/chat/chat-input.tsx`
- `apps/web/components/session/session-panel.tsx`

## Design Decisions

### 1. Base UI over Radix UI

Used @base-ui/react for Collapsible components instead of @radix-ui/react-collapsible to maintain consistency with existing shadcn/ui patterns in the codebase.

### 2. Manual AI Elements Implementation

Instead of using the ai-elements CLI (which requires components.json configuration), manually created simplified AI Elements components that match the Vercel AI SDK patterns while fitting the existing architecture.

### 3. Clean White Background

Removed the DashboardBackground component and changed all bg-background/70 and bg-background/80 to solid bg-white with dark mode support. This creates a cleaner, more modern appearance.

### 4. Avatar-Based Layout

User messages show an avatar, assistant messages do not. This follows modern chat UI patterns (similar to ChatGPT, Claude).

### 5. Inline Tool Display

Tool calls and results now appear inline within messages using the AI Elements Tool component, rather than in a separate activity feed panel.

## State Management

### AI Elements State (in ChatInterface)

```typescript
const [streamingText, setStreamingText] = useState('') // Accumulated text for shimmer
const [currentReasoning, setCurrentReasoning] = useState('') // Reasoning during stream
const [currentSteps, setCurrentSteps] = useState<ChainOfThoughtStep[]>([]) // Tool execution steps
```

### SSE Event Flow

1. Receive `message.part.updated` event
2. Parse part type (text, tool, reasoning)
3. For text: Update streamingText and assistant message content
4. For tool: Adapt to AI Elements format, add to activityTools, rebuild chain-of-thought steps
5. For reasoning: Adapt and append to currentReasoning, rebuild steps
6. On `done` or `session.idle`: Finalize message, clear streaming state

## Dependencies

### packages/ui

- @base-ui/react (existing)
- @hugeicons/react (existing)

### apps/web

- ai-elements adapter (new)
- AI Elements components from @ship/ui

## Migration Path

The implementation maintains backward compatibility with existing API types from `lib/sse-types.ts`. No backend changes were required.

## Verification Checklist

- [x] Run dev server - no build errors
- [x] Avatar-based layout - user avatar shows
- [x] Streaming text - shimmer animation
- [x] Reasoning - collapsible with auto-open/close
- [x] Chain-of-thought - shows tool execution steps
- [x] Tools inline - expandable within messages
- [x] Code blocks - syntax highlighting with copy button
- [x] Prompt input - build/plan toggle works
- [x] Session sidebar - slimmer design with tasks
- [x] Clean background - no dot pattern
- [x] Error messages - still use ErrorMessage component

## Future Improvements

1. Add syntax highlighting languages support to CodeBlock
2. Implement real-time task updates in SessionSidebar via WebSocket
3. Add file diff previews to SessionSidebar
4. Consider adding Conversation wrapper for thread-level features
5. Add message grouping by date/time

## References

- Vercel AI SDK Elements: https://sdk.vercel.ai/docs/ai-sdk-ui/elements
- Base UI: https://base-ui.com
- shadcn/ui Sidebar: https://ui.shadcn.com/docs/components/sidebar
