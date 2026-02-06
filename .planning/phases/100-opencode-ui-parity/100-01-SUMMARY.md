---
phase: 100-opencode-ui-parity
plan: 01
subsystem: api
tags: [models, opencode, big-pickle, ui]

# Dependency graph
requires:
  - phase: None
    provides: Standalone fix
provides:
  - Big Pickle model with correct ID and provider name
  - OpenCode Zen provider grouping in UI
  - Default model selection working correctly
affects: [sessions, model-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Provider ordering in model hooks

key-files:
  created: []
  modified:
    - apps/api/src/routes/models.ts
    - apps/web/lib/api/hooks/use-models.ts
    - apps/web/app/(app)/dashboard/dashboard-client.tsx

key-decisions:
  - "Model ID is 'big-pickle' (not 'opencode/big-pickle')"
  - "Provider displays as 'OpenCode Zen'"
  - 'Added backwards compatibility for old ID'

patterns-established:
  - 'PROVIDER_ORDER constant for consistent provider sorting'

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 100 Plan 01: Fix Big Pickle Model Summary

**Big Pickle model now displays correctly with ID 'big-pickle' under 'OpenCode Zen' provider, sorted first in dropdown**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T03:08:49Z
- **Completed:** 2026-02-05T03:10:33Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Fixed Big Pickle model ID from 'opencode/big-pickle' to 'big-pickle'
- Changed provider name from 'OpenCode' to 'OpenCode Zen'
- Added provider ordering to ensure OpenCode Zen appears first in dropdown
- Updated dashboard to use correct model ID for default selection
- Added backwards compatibility for old model ID

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix model data in models.ts** - `db9e1de` (fix)
2. **Task 2: Fix provider grouping order in use-models.ts** - `077d8b4` (feat)
3. **Task 3: Update dashboard default model selection** - `8a3632e` (fix)

## Files Created/Modified

- `apps/api/src/routes/models.ts` - Updated FALLBACK_MODELS with correct Big Pickle ID, provider, and metadata
- `apps/web/lib/api/hooks/use-models.ts` - Added PROVIDER_ORDER constant and sorted provider grouping
- `apps/web/app/(app)/dashboard/dashboard-client.tsx` - Updated default model lookup to use 'big-pickle'

## Decisions Made

- Used 'big-pickle' as the canonical model ID (matching OpenCode Zen API)
- Added contextWindow and maxTokens metadata to Big Pickle model entry
- Implemented backwards compatibility for 'opencode/big-pickle' in validation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Big Pickle model now works correctly in UI
- Ready for additional UI parity fixes if needed

---

_Phase: 100-opencode-ui-parity_
_Completed: 2026-02-05_
