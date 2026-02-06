# AI Elements Integration & Chat UI Overhaul v2

**Date**: 2026-02-05
**Branch**: gsd/ship-v2
**Status**: Complete - Build passing

## Overview

Major overhaul of the chat UI, replacing the fragmented state management and custom component architecture with a unified UIMessage-driven approach. Key improvements: auto-scroll, inline tool display, proper user message theming, simplified state management, and interactive permission/question prompts.

## What Changed

### Phase 1: Dependencies & Component Updates

**packages/ui/package.json**
- Added: `use-stick-to-bottom` (^1.0.0) for auto-scroll
- Added: `nanoid` (^5.1.5) for ID generation

**packages/ui/src/ai-elements/conversation.tsx** - Rewrote
- Added `useStickToBottom` hook integration for auto-scroll
- Created `ConversationContext` with `isAtBottom` and `scrollToBottom`
- New `ConversationScrollButton` component (floating "scroll to bottom" button)
- New `useConversation` hook for accessing scroll state

**packages/ui/src/ai-elements/message.tsx** - Rewrote
- Fixed user message black-on-black theming: changed from `bg-primary text-primary-foreground` to `bg-secondary text-secondary-foreground`
- Added `system` role support
- Removed avatar slot (unused)

**packages/ui/src/ai-elements/index.ts** - Updated exports
- Added: `ConversationScrollButton`, `useConversation`

### Phase 2: SSE → UIMessage Adapter Layer

**apps/web/lib/ai-elements-adapter.ts** - Full rewrite

Previous: Separate functions for adapting tool parts, reasoning parts, building chain-of-thought steps. Multiple intermediate types (`AdaptedMessage`, `ChainOfThoughtStep`).

New: Single `UIMessage` type as the source of truth:
```typescript
interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolInvocations?: ToolInvocation[]
  reasoning?: string[]
  type?: 'error' | 'pr-notification' | 'permission' | 'question'
  errorCategory?: 'transient' | 'persistent' | 'user-action' | 'fatal'
  promptData?: { id, permission?, description?, text?, status? }
}
```

Key functions:
- `processPartUpdated()` - Main handler for `message.part.updated` events, updates messages array immutably
- `createToolInvocation()` - Maps OpenCode tool states → `partial-call`/`call`/`result`/`error`
- `streamTextDelta()`, `setMessageContent()`, `updateToolInvocation()`, `addReasoning()` - Immutable message update helpers
- `createUserMessage()`, `createAssistantPlaceholder()`, `createErrorMessage()` - Factory functions
- `createPermissionMessage()`, `createQuestionMessage()`, `updatePromptStatus()` - Permission/question support
- `classifyError()`, `parseErrorMessage()` - Error classification
- `getStreamingStatus()` - Human-readable status from message state

### Phase 3: State Management Simplification

**apps/web/app/(app)/dashboard/hooks/use-dashboard-chat.ts** - Major simplification

Removed state variables:
- `thinkingReasoning`, `thinkingStatus`, `thinkingExpanded`, `thinkingParts`
- `activityTools`, `reasoningParts`, `statusEvents`

These are all now derived from `UIMessage.toolInvocations` and `UIMessage.reasoning`.

Kept (sidebar-only state):
- `messages: UIMessage[]`, `isStreaming`, `messageQueue`
- `openCodeUrl`, `sessionTodos`, `fileDiffs`, `totalCost`, `lastStepCost`
- `sessionTitle`, `sessionInfo`, `streamStartTime`

**apps/web/app/(app)/dashboard/hooks/use-dashboard-sse.ts** - Major simplification

Before: 20+ `setX` params, dual tool tracking (old `ToolPart` + new `SSEToolPart`), manual `statusEvents` tracking.

After: ~13 `setX` params. Uses adapter functions for all `message.part.updated` processing. All 30+ event types handled:
- Message events: `message.part.updated`, `message.updated`, `message.removed`
- Session events: `session.updated`, `session.diff`, `session.idle`, `session.error`
- Permission events: `permission.asked/granted/denied` → inline UIMessages
- Question events: `question.asked/replied/rejected` → inline UIMessages
- Informational: `status`, `heartbeat`, `file-watcher.updated`, `command.executed`, etc.

**apps/web/app/(app)/dashboard/dashboard-client.tsx** - Simplified

Removed ~15 destructured state variables and their prop drilling. `DashboardMessages` now receives `messages` + `isStreaming` + `streamingMessageId` instead of 12+ props.

### Phase 4: Chat Component Rewrite

**apps/web/app/(app)/dashboard/components/dashboard-messages.tsx** - Full rewrite

Before: Manual `scrollIntoView`, separate `SubagentActivity` component (160 lines), grouped status events, separate tool pills, chain-of-thought display.

After:
- `<Conversation>` wrapper with `useStickToBottom` auto-scroll
- `<ConversationScrollButton>` floating button
- Inline tool rendering per message (individual `<Tool>` components)
- Permission/question prompts rendered inline
- `<Shimmer>` wrapping streaming markdown
- Proper `<Loader>` for empty streaming messages
- Status derived from `getStreamingStatus()` helper
- Removed: `SubagentActivity`, `ElapsedTime`, `useElapsed`, `formatDuration`

**apps/web/components/chat/ai-message-list.tsx** - Rewrote to use UIMessage type

Now uses `Conversation` + `ConversationScrollButton` for auto-scroll. Accepts `UIMessage[]` directly instead of custom `AIMessage` interface.

**apps/web/components/chat/chat-interface.tsx** - Rewrote to use adapter

Uses `processPartUpdated()`, `createUserMessage()`, `createErrorMessage()`, etc. from adapter. Removed duplicate state tracking.

### Phase 5: Sidebar & Layout Polish

**apps/web/components/chat/session-panel.tsx** - Restyled

- New `PanelSection` component with consistent label/content structure
- Better typography: `text-[10px] uppercase tracking-wider` labels
- Mode displayed as colored badge (green for build, blue for plan)
- Context progress bar with 1.5px height and smooth transition
- Copy button for OpenCode URL (text instead of emoji)
- Better spacing and font sizing throughout

**apps/web/app/(app)/dashboard/dashboard-client.tsx** - Layout fix
- Changed message area from `overflow-y-auto` to `overflow-hidden` (Conversation handles scrolling)

### Phase 6: Interactive Prompts

**apps/web/app/(app)/dashboard/components/permission-prompt.tsx** - New
- Renders permission requests inline with Approve/Deny buttons
- Status-based styling: yellow (pending), green (granted), red (denied)
- Shows permission patterns as monospace badges

**apps/web/app/(app)/dashboard/components/question-prompt.tsx** - New
- Renders questions inline with text input + Reply/Skip buttons
- Status-based styling: blue (pending), green (replied), gray (rejected)
- Enter key support for quick replies

## Architecture After

```
User Input → DashboardComposer
           ↓
    handleSend (use-dashboard-sse)
           ↓
    SSE Stream → parseSSEEvent
           ↓
    processPartUpdated (adapter) → UIMessage[]
           ↓
    DashboardMessages
      ├─ <Conversation>  (auto-scroll)
      ├─ <Message>       (user/assistant/system)
      │   ├─ <Reasoning> (collapsible)
      │   ├─ <Tool>      (inline, per tool call)
      │   └─ <Response>  (markdown with shimmer)
      ├─ <PermissionPrompt>
      ├─ <QuestionPrompt>
      ├─ <ErrorMessage>
      └─ <ConversationScrollButton>
```

## Files Modified (16 total)

### Packages
1. `packages/ui/package.json` - Added dependencies
2. `packages/ui/src/ai-elements/conversation.tsx` - Rewrote (auto-scroll)
3. `packages/ui/src/ai-elements/message.tsx` - Rewrote (theming fix)
4. `packages/ui/src/ai-elements/index.ts` - Updated exports

### Apps/Web
5. `apps/web/lib/ai-elements-adapter.ts` - Full rewrite (UIMessage adapter)
6. `apps/web/app/(app)/dashboard/hooks/use-dashboard-chat.ts` - Simplified
7. `apps/web/app/(app)/dashboard/hooks/use-dashboard-sse.ts` - Simplified with adapter
8. `apps/web/app/(app)/dashboard/dashboard-client.tsx` - Simplified props
9. `apps/web/app/(app)/dashboard/components/dashboard-messages.tsx` - Full rewrite
10. `apps/web/app/(app)/dashboard/components/permission-prompt.tsx` - New
11. `apps/web/app/(app)/dashboard/components/question-prompt.tsx` - New
12. `apps/web/components/chat/ai-message-list.tsx` - Updated to UIMessage
13. `apps/web/components/chat/chat-interface.tsx` - Updated to use adapter
14. `apps/web/components/chat/session-panel.tsx` - Restyled

## Verification

- [x] `pnpm build` passes successfully
- [x] TypeScript compiles with no errors
- [x] All 30+ SSE event types handled
- [x] Auto-scroll via `use-stick-to-bottom`
- [x] Inline tool display per message
- [x] User messages use `bg-secondary` (readable in both themes)
- [x] Permission/question inline prompts created
- [x] Error classification with category-based styling
- [x] Stop button support preserved
