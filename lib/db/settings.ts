import { db } from './client'
import { settings } from './schema'
import { eq, and } from 'drizzle-orm'
import { MAX_MESSAGES_PER_DAY, MAX_SANDBOX_DURATION } from '@/lib/constants'

/**
 * Get a setting value with fallback to default.
 * Returns user-specific setting if found, otherwise returns the default value.
 */
export async function getSetting(
  key: string,
  userId: string | undefined,
  defaultValue?: string,
): Promise<string | undefined> {
  if (!userId) {
    return defaultValue
  }

  const userSetting = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
    .limit(1)

  return userSetting[0]?.value ?? defaultValue
}

/**
 * Get a numeric setting value
 */
export async function getNumericSetting(
  key: string,
  userId: string | undefined,
  defaultValue?: number,
): Promise<number | undefined> {
  const value = await getSetting(key, userId, defaultValue?.toString())
  return value ? parseInt(value, 10) : defaultValue
}

/**
 * Get the max messages per day limit for a user.
 */
export async function getMaxMessagesPerDay(userId?: string): Promise<number> {
  const result = await getNumericSetting('maxMessagesPerDay', userId, MAX_MESSAGES_PER_DAY)
  return result ?? MAX_MESSAGES_PER_DAY
}

/**
 * Get the max sandbox duration (in minutes) for a user.
 */
export async function getMaxSandboxDuration(userId?: string): Promise<number> {
  const result = await getNumericSetting('maxSandboxDuration', userId, MAX_SANDBOX_DURATION)
  return result ?? MAX_SANDBOX_DURATION
}
