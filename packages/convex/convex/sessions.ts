import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("starting"),
        v.literal("running"),
        v.literal("idle"),
        v.literal("stopped"),
        v.literal("error")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    let sessions;
    if (args.status) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    return sessions;
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      return null;
    }

    return session;
  },
});

export const create = mutation({
  args: {
    repoUrl: v.string(),
    repoName: v.string(),
    branch: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      repoUrl: args.repoUrl,
      repoName: args.repoName,
      branch: args.branch,
      status: "starting",
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("sessions"),
    status: v.union(
      v.literal("starting"),
      v.literal("running"),
      v.literal("idle"),
      v.literal("stopped"),
      v.literal("error")
    ),
    modalSandboxId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      modalSandboxId: args.modalSandboxId,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation for API to update session status without auth check
export const internalUpdateStatus = internalMutation({
  args: {
    id: v.id("sessions"),
    status: v.union(
      v.literal("starting"),
      v.literal("running"),
      v.literal("idle"),
      v.literal("stopped"),
      v.literal("error")
    ),
    modalSandboxId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      modalSandboxId: args.modalSandboxId,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

export const stop = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.id, {
      status: "stopped",
      updatedAt: Date.now(),
    });
  },
});
