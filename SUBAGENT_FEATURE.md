# Subagent Sub-Page Feature Implementation

## Overview

I've implemented a subagent sub-page feature that allows users to click on subagent (task) tools and view detailed information about the subagent session in a slide-out panel.

## What Was Built

### 1. Subagent Detection Utilities (`lib/subagent/utils.ts`)

- `isSubagentToolInvocation()` - Detects if a tool is a subagent task
- `extractSubagentSessionId()` - Extracts the session ID from tool metadata
- `getSubagentTaskTitle()` - Gets a display title for the subagent
- `getSubagentType()` - Gets the subagent type (e.g., 'research')
- `getSubagentDescription()` - Gets the task description

### 2. Type Definitions (`lib/subagent/types.ts`)

- `SubagentSessionInfo` - Session metadata and status
- `SubagentToolInvocation` - Extended tool invocation type
- `SubagentViewState` - UI state management types
- API response types for future backend integration

### 3. State Management (`lib/subagent/subagent-context.tsx`)

- `SubagentProvider` - Context provider for global state
- `useSubagent()` - Hook to access subagent state and actions
- `openSubagent()`, `closeSubagent()`, `toggleSubagent()` - Actions

### 4. Extended Tool Component (`packages/ui/src/ai-elements/tool.tsx`)

Added new props:

- `sessionId?: string` - Session ID for subagent tools
- `onViewSubagent?: (sessionId: string) => void` - Click handler
- `subagentLabel?: string` - Custom button label

When a Tool has a `sessionId`, it displays a "View details" button that triggers the sheet.

### 5. Subagent Sheet Component (`components/chat/subagent-sheet.tsx`)

A slide-out panel (600px wide from right) that shows:

- **Status Card**: Current status, progress bar, timing, cost, token usage
- **Tool Executions**: List of tools the subagent has run
- **Recent Activity**: Preview of messages/activity
- **Navigation**: "Open in Session View" button to navigate to full session

### 6. Updated AIMessageList (`components/chat/ai-message-list.tsx`)

- Wrapped with `SubagentProvider`
- Detects subagent tools and passes `sessionId` and `onViewSubagent` to Tool components
- Renders `SubagentSheet` for the active subagent view

## User Flow

```
1. User sees a "task" tool in the conversation
   ↓
2. Tool displays with "View details" button (if it has a sessionId)
   ↓
3. User clicks "View details"
   ↓
4. Sheet slides in from right showing:
   - Subagent status and progress
   - Tool execution timeline
   - Cost and token information
   - Recent activity preview
   ↓
5. User can:
   - View details in the sheet
   - Click "Open in Session View" to navigate to full session
   - Close the sheet by clicking outside or X
```

## Design Decisions

1. **Sheet over Modal**: Uses a slide-out sheet (like VS Code drawer) to preserve context of the parent conversation while viewing subagent details.

2. **Global State with Context**: The subagent view state is lifted to a Context so any component can trigger it, not just the Tool component.

3. **Session ID Detection**: Follows OpenCode's pattern of looking for `sessionId` in `args.metadata` or `result`.

4. **Mock Data**: Currently uses mock data in the sheet. Ready for API integration when backend supports subagent session queries.

5. **Progressive Enhancement**: Tools without session IDs render normally; only subagent tools get the "View details" button.

## Files Created/Modified

### New Files:

- `apps/web/lib/subagent/utils.ts`
- `apps/web/lib/subagent/types.ts`
- `apps/web/lib/subagent/subagent-context.tsx`
- `apps/web/lib/subagent/index.ts`
- `apps/web/components/chat/subagent-sheet.tsx`
- `apps/web/components/chat/index.ts`

### Modified Files:

- `packages/ui/src/ai-elements/tool.tsx` - Added subagent props and UI
- `apps/web/components/chat/ai-message-list.tsx` - Integrated subagent support

## Next Steps / Questions

1. **API Integration**: Should I add API routes to fetch real subagent session data?
   - `/api/subagents/[id]` - Get subagent session
   - `/api/subagents/[id]/messages` - Get subagent messages
   - `/api/sessions/[id]/subagents` - List all subagents for a session

2. **Real-time Updates**: Should the sheet poll for updates while the subagent is running?

3. **Enhanced Tool Display**: Should we show nested tools within the subagent in the sheet?

4. **Navigation Patterns**: Should clicking a subagent navigate to a full page instead of opening a sheet?

5. **Visual Design**: Any specific styling preferences for the sheet content?

## Screenshots

The feature adds:

- A "View details" button next to subagent tool names
- A slide-out panel with session information
- Progress indicators and tool execution timeline
- Quick navigation to full session view

## Type Check Results

✅ All TypeScript checks pass for both `apps/web` and `packages/ui`
