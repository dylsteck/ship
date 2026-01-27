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
    sandboxId: v.optional(v.string()),
    sandboxUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    // Optional API key for server-side calls
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if API key is provided (for server-side calls)
    const expectedApiKey = process.env.API_KEY;
    if (args.apiKey && expectedApiKey && args.apiKey === expectedApiKey) {
      // API key auth - allow update without user check
      await ctx.db.patch(args.id, {
        status: args.status,
        sandboxId: args.sandboxId,
        sandboxUrl: args.sandboxUrl,
        previewUrl: args.previewUrl,
        errorMessage: args.errorMessage,
        updatedAt: Date.now(),
      });
      return;
    }

    // Otherwise, require user authentication
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
      sandboxId: args.sandboxId,
      sandboxUrl: args.sandboxUrl,
      previewUrl: args.previewUrl,
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
    sandboxId: v.optional(v.string()),
    sandboxUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      sandboxId: args.sandboxId,
      sandboxUrl: args.sandboxUrl,
      previewUrl: args.previewUrl,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

// Update PR info
export const updatePR = mutation({
  args: {
    id: v.id("sessions"),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    prStatus: v.optional(v.union(v.literal("draft"), v.literal("open"), v.literal("merged"), v.literal("closed"))),
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
      prUrl: args.prUrl,
      prNumber: args.prNumber,
      prStatus: args.prStatus,
      updatedAt: Date.now(),
    });
  },
});

// Update files changed
export const updateFilesChanged = internalMutation({
  args: {
    id: v.id("sessions"),
    filesChanged: v.array(v.object({
      path: v.string(),
      additions: v.number(),
      deletions: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      filesChanged: args.filesChanged,
      updatedAt: Date.now(),
    });
  },
});

// Update tasks
export const updateTasks = mutation({
  args: {
    id: v.id("sessions"),
    tasks: v.array(v.object({
      id: v.string(),
      content: v.string(),
      completed: v.boolean(),
    })),
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
      tasks: args.tasks,
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

export const deleteSession = mutation({
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

    // Delete all messages for this session
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the session
    await ctx.db.delete(args.id);
  },
});
