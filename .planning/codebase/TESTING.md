# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Runner:**
- Not detected - No Jest, Vitest, or other test runner found in project

**Assertion Library:**
- Not detected - No testing framework configured

**Run Commands:**
- No test scripts in `package.json`
- Scripts available: `npm run lint`, `npm run type-check`, `npm run format`

## Test File Organization

**Location:**
- No test files found in application code
- No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files in `app/`, `components/`, or `lib/` directories
- Testing capability: Not currently implemented

**Naming:**
- Would follow pattern `[name].test.ts` or `[name].spec.ts` if implemented
- Test files would be co-located with source files (Next.js convention)

**Structure:**
- Test infrastructure: Not established

## Test Structure

**Suite Organization:**
- No test suites currently implemented
- Project relies on:
  - `npm run type-check` (TypeScript type checking)
  - `npm run lint` (ESLint static analysis)
  - `npm run format:check` (Prettier formatting validation)

**Patterns:**
- Test setup: Not established
- Test teardown: Not established
- Assertion patterns: Not established

## Mocking

**Framework:**
- Not configured - No mocking library installed (no jest, vitest, or similar)

**Patterns:**
- Mocking capability: Not available in current setup

**What to Mock:**
- Guidance: Not established

**What NOT to Mock:**
- Guidance: Not established

## Fixtures and Factories

**Test Data:**
- No fixture files or factory functions found
- Dynamic test data generation: Not implemented

**Location:**
- Would likely be in `__tests__/fixtures/` or `__tests__/factories/` if implemented

## Coverage

**Requirements:**
- None enforced - No coverage tool configured

**View Coverage:**
- Coverage measurement: Not available

## Test Types

**Unit Tests:**
- Not implemented
- Scope would be: Individual functions, utilities, hooks, components in isolation
- Approach would be: Pure function testing, mock external dependencies

**Integration Tests:**
- Not implemented
- Scope would be: API routes, database operations, component interactions
- Approach would be: Test real database context, mock external services

**E2E Tests:**
- Not implemented
- Framework: Not selected
- Would test: Full user workflows, task creation and execution, GitHub integration flows

## Current Testing Approach

**Type Safety:**
- Primary quality assurance via TypeScript strict mode
- Type checking enforced: `npm run type-check` (tsc --noEmit)
- TypeScript config: `tsconfig.json` with `strict: true`
- Coverage: All source files (.ts, .tsx) type-checked

**Linting:**
- ESLint enforces code patterns and catches potential errors
- Rules configured in `eslint.config.mjs`:
  - `@typescript-eslint/no-unused-vars` warns on unused variables (allows `_` prefix)
  - `@typescript-eslint/no-explicit-any` warns on `any` types
- Run: `npm run lint`

**Code Formatting:**
- Prettier enforces consistent formatting
- Configuration in `package.json`:
  - Single quotes
  - 120 character line width
  - Trailing commas on all
  - No semicolons
- Run: `npm run format` or `npm run format:check`

## Validation Testing Approach

**Zod Schemas:**
- Data validation at boundaries using Zod library
- Schema definitions in `lib/db/schema.ts`:
  - `insertUserSchema` - User creation validation
  - `selectUserSchema` - User data type
  - `logEntrySchema` - Log entry validation
  - Similar schemas for tasks, messages, settings

**Example from `app/api/tasks/route.ts`:**
```typescript
const validatedData = insertTaskSchema.parse({
  ...body,
  id: taskId,
  userId: session.user.id,
  status: 'pending',
  progress: 0,
  logs: [],
})
```

**Database Schema Validation:**
- Drizzle ORM defines table schemas with type safety
- Schema file: `lib/db/schema.ts`
- Types inferred from Zod schemas and Drizzle tables
- Provides compile-time and runtime type checking

## Testing Recommendations

**To Implement Unit Testing:**
1. Install test runner: `npm install -D vitest` (or Jest)
2. Create test config file
3. Add test scripts to `package.json`
4. Start with critical paths: authentication, API routes, utilities
5. Follow existing type patterns for test data

**Critical Areas for Testing:**
- `lib/session/` - Authentication and session management
- `lib/db/` - Database operations and queries
- `lib/sandbox/` - Sandbox creation and agent execution
- `app/api/` - API route handlers
- Authentication flow (`lib/auth/providers.ts`)
- Rate limiting logic (`lib/utils/rate-limit.ts`)

**Component Testing Approach:**
- Would use React Testing Library for component tests
- Test user interactions, not implementation details
- Mock API calls and external dependencies
- Keep component logic minimal (prefer logic in hooks/utilities)

---

*Testing analysis: 2026-02-01*
