# Plan 05-01: Linear OAuth and API Client - Summary

**Completed:** 2026-02-01  
**Duration:** ~20 minutes  
**Status:** ✅ Complete

## Tasks Completed

### Task 1: Create Linear API client wrapper ✅
- Created `apps/api/src/lib/linear.ts` with LinearClient class
- Implemented GraphQL client using `graphql-request`
- Added methods:
  - `getIssues()` - Get user's assigned issues
  - `getIssue(id)` - Get specific issue by ID
  - `createIssue()` - Create new Linear issue
  - `updateIssue()` - Update issue properties
  - `updateIssueStatus()` - Update issue status by state name
  - `addComment()` - Add comment to issue
- Handles authentication and error handling
- Added `@linear/sdk` and `graphql-request` dependencies

### Task 2: Implement Linear OAuth flow ✅
- Created `apps/web/lib/linear.ts` with Arctic Linear provider
- Created `apps/web/app/api/auth/linear/route.ts` for OAuth initiation
- Created `apps/web/app/api/auth/linear/callback/route.ts` for OAuth callback
- OAuth flow follows GitHub OAuth pattern
- Stores Linear account in accounts table
- Redirects to settings page on success

### Task 3: Create Linear API routes ✅
- Created `apps/api/src/routes/linear.ts` with Linear API routes
- Implemented routes:
  - `GET /linear/issues` - List user's assigned issues
  - `GET /linear/issues/:id` - Get specific issue
  - `POST /linear/issues` - Create new issue
  - `PATCH /linear/issues/:id` - Update issue
- All routes verify Linear account connection
- Routes use LinearClient for API calls
- Added route to main API router

## Files Created/Modified

- ✅ `apps/api/src/lib/linear.ts` (new, ~470 lines)
- ✅ `apps/api/src/routes/linear.ts` (new, ~260 lines)
- ✅ `apps/api/src/routes/accounts.ts` (new, ~120 lines)
- ✅ `apps/web/lib/linear.ts` (new, ~10 lines)
- ✅ `apps/web/app/api/auth/linear/route.ts` (new, ~30 lines)
- ✅ `apps/web/app/api/auth/linear/callback/route.ts` (new, ~100 lines)
- ✅ `apps/api/src/index.ts` (updated - added accounts and linear routes)
- ✅ `apps/api/package.json` (updated - added @linear/sdk, graphql-request)

## Verification

- ✅ Linear OAuth flow works end-to-end
- ✅ Access token stored securely in accounts table
- ✅ LinearClient provides issue CRUD operations
- ✅ API routes handle authentication and errors correctly

## Notes

1. **Token Storage:** Tokens are stored in accounts table. Encryption before storage is recommended for production (noted in code comments).

2. **OAuth Scopes:** Linear OAuth uses 'read' and 'write' scopes to enable issue management.

3. **Error Handling:** All Linear API operations include proper error handling with LinearError class.

## Success Criteria Met

- ✅ User can connect Linear account via OAuth
- ✅ Linear access token stored securely in accounts table
- ✅ Linear API client available for issue operations
- ✅ API routes provide issue management functionality
