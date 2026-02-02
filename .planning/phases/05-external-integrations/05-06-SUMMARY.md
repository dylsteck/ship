# Plan 05-06: Connector Management UI and API - Summary

**Completed:** 2026-02-01  
**Duration:** ~10 minutes  
**Status:** ✅ Complete

## Tasks Completed

### Task 1: Create connector management API ✅
- Created `apps/api/src/routes/connectors.ts` with connector management routes
- Implemented routes:
  - `GET /connectors` - List all connectors with enabled status
  - `GET /connectors/:name/status` - Get connector connection and enabled status
  - `POST /connectors/:name/enable` - Enable connector
  - `POST /connectors/:name/disable` - Disable connector
- State stored in `user_preferences` table with key format `connector.{name}.enabled`
- Checks account connection status from `accounts` table
- Default behavior: enabled if connected (when no preference set), disabled if not connected
- Added route to main API router

### Task 2: Create connector settings UI component ✅
- Created `apps/web/components/settings/connector-settings.tsx`
- Displays list of connectors (GitHub, Linear, Vercel)
- Shows connection status badges (Connected/Not Connected)
- Shows enable/disable toggle switches
- Provides "Connect" button for OAuth flow
- Provides "Disconnect" button (placeholder - not yet implemented)
- Handles loading and error states
- Matches Ramp design patterns (clean cards, subtle borders)

### Task 3: Integrate connector settings into settings page ✅
- Updated `apps/web/app/(app)/settings/settings-client.tsx`
- Added "Integrations" section below AI Model section
- Imported and rendered `ConnectorSettings` component
- Preserved existing settings page functionality

## Files Created/Modified

- ✅ `apps/api/src/routes/connectors.ts` (new, ~180 lines)
- ✅ `apps/web/components/settings/connector-settings.tsx` (new, ~180 lines)
- ✅ `apps/web/app/(app)/settings/settings-client.tsx` (updated - added connector section)
- ✅ `apps/api/src/index.ts` (updated - added connectors route)

## Verification

- ✅ Connector API routes exist and handle enable/disable operations
- ✅ Connector settings UI displays all connectors with status
- ✅ Enable/disable toggles work correctly
- ✅ Connection status shows correctly (checks accounts table)
- ✅ Connector state persists in user_preferences table
- ✅ Settings page includes connector section

## Notes

1. **Disconnect Functionality:** The disconnect button is a placeholder. Full disconnect would require:
   - API endpoint to remove account from accounts table
   - OAuth token revocation (if supported by provider)

2. **Vercel OAuth:** Vercel OAuth flow is not yet implemented (noted in error message when clicking Connect)

3. **Default Behavior:** Connectors default to enabled if account is connected (when no explicit preference exists), providing sensible defaults while allowing users to disable if needed.

## Success Criteria Met

- ✅ User can enable or disable GitHub/Linear/Vercel connectors in settings
- ✅ Connector state stored in user_preferences table
- ✅ Connector settings UI shows connection status
- ✅ Connector state persists and affects integration behavior
