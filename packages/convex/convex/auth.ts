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
