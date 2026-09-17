/** User model preference persistence and normalization. */

import type { ModelPreferences, UpdateModelPreferences } from '@ship/contracts'

import type { Env } from '../env.d'
import { DEFAULT_ACP_MODEL_ID, getDefaultAgentId, listAgents } from './agent-registry'

const KEYS = ['default_agent', 'default_model_by_agent', 'favorite_model_ids', 'recent_model_ids'] as const

/** Read a complete preference object with stable system defaults. */
export async function readModelPreferences(env: Env, userId: string): Promise<ModelPreferences> {
  const result = await env.DB.prepare(
    `SELECT key, value FROM user_preferences WHERE user_id = ? AND key IN (?, ?, ?, ?)`,
  )
    .bind(userId, ...KEYS)
    .all<{ key: string; value: string | null }>()
  const values = Object.fromEntries(result.results.map((row) => [row.key, row.value || '']))
  const agents = await listAgents()
  const defaults = Object.fromEntries(
    agents.map((agent) => [agent.id, agent.models.find((model) => model.isDefault)?.id || agent.models[0]?.id || DEFAULT_ACP_MODEL_ID]),
  )
  return {
    defaultAgentId: values.default_agent || getDefaultAgentId(),
    defaultModelByAgent: { ...defaults, ...parseRecord(values.default_model_by_agent) },
    favoriteModelIds: parseArray(values.favorite_model_ids).slice(0, 20),
    recentModelIds: parseArray(values.recent_model_ids).slice(0, 8),
  }
}

/** Merge and persist a validated preference patch. */
export async function updateModelPreferences(
  env: Env,
  userId: string,
  patch: UpdateModelPreferences,
): Promise<ModelPreferences> {
  const current = await readModelPreferences(env, userId)
  const next: ModelPreferences = {
    defaultAgentId: patch.defaultAgentId ?? current.defaultAgentId,
    defaultModelByAgent: patch.defaultModelByAgent ?? current.defaultModelByAgent,
    favoriteModelIds: unique(patch.favoriteModelIds ?? current.favoriteModelIds).slice(0, 20),
    recentModelIds: unique(patch.recentModelIds ?? current.recentModelIds).slice(0, 8),
  }
  await Promise.all([
    putPreference(env, userId, 'default_agent', next.defaultAgentId),
    putPreference(env, userId, 'default_model_by_agent', JSON.stringify(next.defaultModelByAgent)),
    putPreference(env, userId, 'favorite_model_ids', JSON.stringify(next.favoriteModelIds)),
    putPreference(env, userId, 'recent_model_ids', JSON.stringify(next.recentModelIds)),
  ])
  return next
}

/** Move a successful model selection to the front of the recent list. */
export async function recordRecentModel(env: Env, userId: string, modelId: string): Promise<ModelPreferences> {
  const current = await readModelPreferences(env, userId)
  return updateModelPreferences(env, userId, {
    recentModelIds: [modelId, ...current.recentModelIds.filter((id) => id !== modelId)].slice(0, 8),
  })
}

async function putPreference(env: Env, userId: string, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
  )
    .bind(userId, key, value)
    .run()
}

function parseArray(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function parseRecord(value: string | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
