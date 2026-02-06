---
phase: 01-foundation-authentication
plan: 02
subsystem: database
tags: [d1, database, schema, user-management, api, hono, cloudflare]

dependency-graph:
  requires:
    - 01-01  # Monorepo scaffold with API and types packages
  provides:
    - D1 database schema (users, accounts, sessions)
    - User management API endpoints
    - Shared TypeScript types for auth
  affects:
    - 01-03  # OAuth callback will use user upsert endpoint
    - 02-*   # Session management will use sessions table

tech-stack:
  added:
    - cloudflare-d1  # Serverless SQL database
  patterns:
    - auth-js-schema  # Standard Auth.js table structure
    - dto-pattern  # Separate DTO types to prevent data leakage

file-tracking:
  created:
    - apps/api/src/db/schema.sql
    - apps/api/src/db/migrate.ts
    - apps/api/src/routes/users.ts
    - packages/types/src/user.ts
    - packages/types/src/auth.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/package.json
    - packages/types/src/index.ts
    - packages/types/package.json

decisions:
  - id: d1-auth-schema
    title: Use Auth.js D1 adapter schema
    choice: Standard users/accounts/sessions table structure
    rationale: Well-tested pattern, community support, future Auth.js integration
    alternatives: [Custom schema design]

  - id: user-dto
    title: Separate DTO types for API responses
    choice: UserDTO excludes githubId and timestamps
    rationale: Prevent leaking internal identifiers and implementation details
    alternatives: [Return full User object]

  - id: unix-timestamps
    title: Use Unix timestamps (seconds) for dates
    choice: INTEGER columns with unixepoch()
    rationale: SQLite/D1 best practice, efficient storage, simple arithmetic
    alternatives: [ISO8601 strings, milliseconds]

metrics:
  duration: 2min
  completed: 2026-02-01
---

# Phase 01 Plan 02: D1 Database Schema and User API Summary

**One-liner:** D1 database with Auth.js-compatible schema and user CRUD API using Hono

## What Was Built

Created the database foundation for Ship's authentication system:

1. **D1 Database Schema**
   - Users table: Core user data (id, github_id, username, email, name, avatar_url)
   - Accounts table: OAuth provider connections
   - Sessions table: User session tracking
   - Indexes for common query patterns

2. **User Management API**
   - POST /users/upsert: Create or update user by GitHub ID
   - GET /users/:id: Retrieve user data
   - D1 database integration with Hono
   - Proper error handling and validation

3. **Shared TypeScript Types**
   - User, CreateUserInput, UserDTO for user data
   - Session and Account for auth entities
   - Exported from @ship/types for monorepo-wide use

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @ship/types dependency to API package**
- **Found during:** Task 2 - TypeScript compilation
- **Issue:** API couldn't import types from @ship/types (module not found)
- **Fix:** Added `"@ship/types": "workspace:*"` to apps/api/package.json dependencies
- **Files modified:** apps/api/package.json
- **Commit:** ab819c3

**2. [Rule 3 - Blocking] Updated @ship/types package.json exports**
- **Found during:** Task 2 - TypeScript compilation
- **Issue:** Types package only had wildcard export, no main entry point
- **Fix:** Added main, types, and "." export to packages/types/package.json
- **Files modified:** packages/types/package.json
- **Commit:** ab819c3

## Technical Details

### Database Schema

Auth.js-compatible schema with SQLite/D1 optimizations:

**Users Table:**
- Primary key: UUID (TEXT)
- GitHub ID: Unique constraint for OAuth lookups
- Index on github_id for fast OAuth queries

**Accounts Table:**
- Links users to OAuth providers
- Stores access/refresh tokens
- Composite unique constraint on (provider, provider_account_id)

**Sessions Table:**
- Links to users with foreign key
- Expires_at index for efficient session cleanup queries

### API Endpoints

**POST /users/upsert:**
```typescript
Input: CreateUserInput { githubId, username, email?, name?, avatarUrl? }
Output: { userId: string, isNewUser: boolean }
```
- Checks for existing user by github_id
- Creates new user if not found, updates if found
- Returns same userId on update (idempotent)

**GET /users/:id:**
```typescript
Output: UserDTO { id, username, email, name, avatarUrl }
```
- Returns DTO (excludes githubId, timestamps)
- 404 if user not found

### Type System

Separation of concerns in types:
- **User:** Full internal representation
- **CreateUserInput:** API input validation
- **UserDTO:** Public API response (no sensitive fields)

## Verification Results

✅ All verification criteria met:

**Database:**
- ✅ D1 local database has users, accounts, sessions tables
- ✅ All indexes created successfully
- ✅ Schema executed without errors

**API:**
- ✅ POST /users/upsert creates new user (isNewUser: true)
- ✅ POST /users/upsert updates existing user (isNewUser: false)
- ✅ GET /users/:id returns user DTO
- ✅ GET /users/:id with invalid ID returns 404

**Types:**
- ✅ @ship/types exports all auth types
- ✅ TypeScript compilation successful
- ✅ Workspace dependency resolution working

## Next Phase Readiness

**Ready for Phase 01-03 (OAuth Flow):**
- ✅ User upsert endpoint ready for OAuth callback
- ✅ Database schema supports account linking
- ✅ Types exported for OAuth integration

**Ready for Phase 02 (Session Management):**
- ✅ Sessions table created
- ✅ Foreign key to users established
- ✅ Expires_at index for cleanup queries

**No blockers or concerns.**

## Key Learnings

1. **Workspace dependencies:** pnpm workspace protocol (`workspace:*`) required for local package references
2. **Package exports:** Need both main entry point and wildcard exports for TypeScript resolution
3. **D1 indexes:** SQLite automatically creates indexes for UNIQUE constraints (sqlite_autoindex_*)
4. **Unix timestamps:** D1/SQLite unixepoch() function provides consistent timestamp format

## Commit Summary

| Task | Commit  | Message                                        |
| ---- | ------- | ---------------------------------------------- |
| 1    | db51adc | feat(01-02): create D1 database schema and migration |
| 2    | ab819c3 | feat(01-02): create shared types and user API routes |

Total commits: 2
Duration: 2 minutes
