import { query } from "./_generated/server";
import { auth } from "./auth";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Return user - githubAccessToken should be stored during OAuth callback
    // If not available, it will be synced via the auth callback
    return user;
  },
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      githubUsername: user.githubUsername,
    };
  },
});
