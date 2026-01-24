import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Type guard for GitHub profile
function isGitHubProfile(profile: unknown): profile is {
  id?: number;
  login?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
} {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as Record<string, unknown>;
  return (
    (p.id === undefined || typeof p.id === "number") &&
    (p.login === undefined || typeof p.login === "string") &&
    (p.name === undefined || typeof p.name === "string") &&
    (p.email === undefined || typeof p.email === "string") &&
    (p.avatar_url === undefined || typeof p.avatar_url === "string")
  );
}

// Extract access token from args safely
function getAccessToken(args: Record<string, unknown>): string | undefined {
  const account = args.account;
  if (!account || typeof account !== "object") return undefined;
  const acc = account as Record<string, unknown>;
  return typeof acc.access_token === "string" ? acc.access_token : undefined;
}

// Get string field from profile safely
function getProfileString(profile: unknown, field: string): string | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  const p = profile as Record<string, unknown>;
  const value = p[field];
  return typeof value === "string" ? value : undefined;
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      const allowedOrigins = [
        "https://ship.dylansteck.com",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ];

      try {
        const urlObj = new URL(redirectTo);
        const isAllowed = allowedOrigins.some(
          (origin) =>
            urlObj.origin === origin || urlObj.origin === new URL(origin).origin
        );

        if (isAllowed) {
          return redirectTo;
        }
      } catch {
        // Invalid URL, fall back to SITE_URL
      }

      return process.env.SITE_URL || "https://ship.dylansteck.com";
    },
    async createOrUpdateUser(ctx, args): Promise<Id<"users">> {
      const { existingUserId, profile, provider } = args;
      const accessToken = getAccessToken(args as Record<string, unknown>);

      if (provider?.id === "github" && profile && isGitHubProfile(profile)) {
        const userData = {
          name: profile.name ?? profile.login ?? "User",
          email: profile.email,
          image: profile.avatar_url,
          githubId: profile.id !== undefined ? String(profile.id) : undefined,
          githubUsername: profile.login,
          githubAccessToken: accessToken,
        };

        if (existingUserId) {
          const user = await ctx.db.get(existingUserId);
          if (!user) {
            return await ctx.db.insert("users", userData);
          }

          await ctx.db.patch(existingUserId, userData);
          return existingUserId;
        }

        return await ctx.db.insert("users", userData);
      }

      // Fallback for non-GitHub providers
      return await ctx.db.insert("users", {
        name: getProfileString(profile, "name") ?? "User",
        email: getProfileString(profile, "email"),
      });
    },
  },
});
