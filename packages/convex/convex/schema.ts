import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Override authAccounts to include accessToken
const customAuthTables = {
  ...authTables,
  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
  })
    .index("userIdAndProvider", ["userId", "provider"])
    .index("providerAndAccountId", ["provider", "providerAccountId"]),
};

export default defineSchema({
  ...customAuthTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    githubId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubAccessToken: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
  })
    .index("by_github_id", ["githubId"])
    .index("email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    repoUrl: v.string(),
    repoName: v.string(),
    branch: v.string(),
    status: v.union(
      v.literal("starting"),
      v.literal("running"),
      v.literal("idle"),
      v.literal("stopped"),
      v.literal("error")
    ),
    // Sandbox info (Vercel Sandbox)
    sandboxId: v.optional(v.string()),
    sandboxUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    // PR info
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    prStatus: v.optional(v.union(v.literal("draft"), v.literal("open"), v.literal("merged"), v.literal("closed"))),
    // Files changed tracking
    filesChanged: v.optional(v.array(v.object({
      path: v.string(),
      additions: v.number(),
      deletions: v.number(),
    }))),
    // Tasks tracking
    tasks: v.optional(v.array(v.object({
      id: v.string(),
      content: v.string(),
      completed: v.boolean(),
    }))),
    // Error info
    errorMessage: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
});
