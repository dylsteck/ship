/** Cloudflare bindings plus optional deployment-specific secrets. */
export interface Env extends CloudflareBindings {
  DISABLE_RATE_LIMITS?: string;
  ALLOWED_ORIGINS?: string;
  VERCEL_PROJECT_NAME?: string;

  // Optional agent API keys / ACP backends (inject into sandbox env at runtime — single-tenant MVP)
  OPENAI_API_KEY?: string;
  /** ChatGPT / Codex subscription — enterprise agent-identity token (`codex login --with-access-token`) */
  CODEX_ACCESS_TOKEN?: string;
  /** ChatGPT / Codex subscription — full `~/.codex/auth.json` after local `codex login` (personal subs) */
  CODEX_AUTH_JSON?: string;
  /** Cursor CLI (`agent acp`) — pick one auth style */
  CURSOR_API_KEY?: string;
  CURSOR_AUTH_TOKEN?: string;
  /** OpenCode CLI (`opencode acp`) */
  OPENCODE_API_KEY?: string;

  /** Optional ACP command overrides for pinned or custom sandbox template installs. */
  SHIP_ACP_CURSOR_CMD?: string;
  SHIP_ACP_CODEX_CMD?: string;
  SHIP_ACP_CLAUDE_CMD?: string;
  SHIP_ACP_OPENCODE_CMD?: string;

  /** GitHub OAuth app credentials — used to refresh user access tokens for private repo clone/git */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

}
