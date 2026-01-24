import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    githubId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubAccessToken: v.optional(v.string()),
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
    modalSandboxId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
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
