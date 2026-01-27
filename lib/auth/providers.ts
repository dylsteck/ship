/**
 * Authentication is GitHub-only
 */
export function getEnabledAuthProviders(): {
  github: boolean
} {
  return {
    github: true,
  }
}
