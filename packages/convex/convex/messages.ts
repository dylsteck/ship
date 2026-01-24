import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { auth } from "./auth";

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Verify user owns this session
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return messages;
  },
});

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user owns this session
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const messageId = await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });

    // Update session to running status
    await ctx.db.patch(args.sessionId, {
      status: "running",
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Internal mutation for API to add assistant/system messages
export const internalAdd = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,
      createdAt: Date.now(),
    });

    return messageId;
  },
});

// Get the latest message for preview
export const latestForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(1);

    return messages[0] ?? null;
  },
});
