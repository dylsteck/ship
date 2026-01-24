import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

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
      // Allow redirects to production or localhost
      const allowedOrigins = [
        "https://ship.dylansteck.com",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ];
      
      try {
        const urlObj = new URL(redirectTo);
        const isAllowed = allowedOrigins.some(origin => 
          urlObj.origin === origin || urlObj.origin === new URL(origin).origin
        );
        
        if (isAllowed) {
          return redirectTo;
        }
      } catch {
        // Invalid URL, fall back to SITE_URL
      }
      
      // Default to SITE_URL if redirect is not allowed
      return process.env.SITE_URL || "https://ship.dylansteck.com";
    },
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId, profile, provider }) {
      if (provider?.id === "github" && profile) {
        const githubProfile = profile as {
          id: number;
          login: string;
          name?: string;
          email?: string;
          avatar_url?: string;
        };

        await ctx.db.patch(userId, {
          githubId: String(githubProfile.id),
          githubUsername: githubProfile.login,
          name: githubProfile.name ?? githubProfile.login,
          email: githubProfile.email,
          image: githubProfile.avatar_url,
        });
      }
    },
  },
});
