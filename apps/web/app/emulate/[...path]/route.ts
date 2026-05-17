/**
 * Catch-all route that mounts the GitHub emulator under `/emulate/github`.
 *
 * Backed by `@emulators/adapter-next` and the `@emulators/github` plugin.
 * Returns 404 in production AND when the operator hasn't opted in by
 * setting the sentinel `GITHUB_CLIENT_ID=emulate` (see
 * {@link isGitHubEmulatorActive}). The route is therefore invisible
 * unless explicitly enabled and stays a strict no-op in production.
 *
 * Seed users + repos live in {@link githubSeed} so an agent can log in as a
 * deterministic user and immediately see a non-empty repo list.
 *
 * @packageDocumentation
 */

import { createEmulateHandler } from '@emulators/adapter-next'
import * as githubEmulator from '@emulators/github'
import { type GitHubSeedConfig } from '@emulators/github'
import { isGitHubEmulatorActive } from '@/lib/emulate/env'

/**
 * Default users + repos available the moment the emulator boots.
 *
 * `octocat` is the conventional first user; `dogfood-app` gives the agent
 * a small repo to drive end-to-end flows (chat → workspace → PR).
 */
const githubSeed: GitHubSeedConfig = {
  users: [
    {
      login: 'octocat',
      name: 'The Octocat',
      email: 'octocat@users.noreply.localhost',
      bio: 'Default emulator user for autonomous-agent testing.',
    },
  ],
  repos: [
    {
      owner: 'octocat',
      name: 'hello-world',
      description: 'Tiny seed repo for the GitHub emulator.',
      default_branch: 'main',
      auto_init: true,
    },
    {
      owner: 'octocat',
      name: 'dogfood-app',
      description: 'Drive Ship end-to-end inside the emulator.',
      default_branch: 'main',
      auto_init: true,
    },
  ],
}

const handler = createEmulateHandler({
  services: {
    github: { emulator: githubEmulator, seed: githubSeed as unknown as Record<string, unknown> },
  },
})

const notFound = (): Response => new Response('Not found', { status: 404 })

/** Return the emulator handler for {@link method}, or a 404 stub when off. */
function pickHandler(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  if (!isGitHubEmulatorActive()) return notFound
  return handler[method]
}

export const GET = (...args: Parameters<typeof handler.GET>) => pickHandler('GET')(...args)
export const POST = (...args: Parameters<typeof handler.POST>) => pickHandler('POST')(...args)
export const PUT = (...args: Parameters<typeof handler.PUT>) => pickHandler('PUT')(...args)
export const PATCH = (...args: Parameters<typeof handler.PATCH>) => pickHandler('PATCH')(...args)
export const DELETE = (...args: Parameters<typeof handler.DELETE>) => pickHandler('DELETE')(...args)
