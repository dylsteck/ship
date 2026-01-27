import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createSandbox, terminateSandbox, getSandboxStatus } from "../vercel-sandbox.js";
import { OpenCodeClient, type StreamEvent } from "../opencode.js";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

// Get Convex URL and API key for HTTP calls
const getConvexUrl = () => {
  return process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";
};

const getApiKey = () => {
  return process.env.API_KEY || "";
};

// Function references for Convex API (public functions)
const sessionsGet = makeFunctionReference<
  "query",
  { id: string },
  { sandboxId?: string; sandboxUrl?: string; previewUrl?: string; status: string; repoName: string; branch: string } | null
>("sessions:get");

const sessionsDelete = makeFunctionReference<
  "mutation",
  { id: string },
  void
>("sessions:deleteSession");

// Helper to call Convex HTTP action for updating session status
async function updateSessionStatus(
  sessionId: string,
  status: string,
  sandboxId?: string,
  sandboxUrl?: string,
  previewUrl?: string,
  errorMessage?: string
) {
  const convexUrl = getConvexUrl();
  const apiKey = getApiKey();

  if (!convexUrl) {
    throw new Error("CONVEX_URL not configured");
  }

  // Convert Convex cloud URL to site URL for HTTP actions
  const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");

  const response = await fetch(`${siteUrl}/api/sessions/updateStatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      id: sessionId,
      status,
      sandboxId,
      sandboxUrl,
      previewUrl,
      errorMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update session: ${error}`);
  }
}

// Helper to call Convex HTTP action for adding messages
async function addMessage(
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: unknown[],
  toolResults?: unknown[]
) {
  const convexUrl = getConvexUrl();
  const apiKey = getApiKey();

  if (!convexUrl) {
    throw new Error("CONVEX_URL not configured");
  }

  // Convert Convex cloud URL to site URL for HTTP actions
  const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");

  const response = await fetch(`${siteUrl}/api/messages/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      sessionId,
      role,
      content,
      toolCalls,
      toolResults,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add message: ${error}`);
  }
}

// Store active OpenCode clients by session ID
const openCodeClients = new Map<string, OpenCodeClient>();

export function createSessionRoutes(convex: ConvexHttpClient) {
  const app = new Hono();

  // Create a new session
  app.post(
    "/",
    zValidator(
      "json",
      z.object({
        sessionId: z.string(),
        repoUrl: z.string().url(),
        branch: z.string(),
        githubToken: z.string(),
      })
    ),
    async (c) => {
      const { sessionId, repoUrl, branch, githubToken } = c.req.valid("json");
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

      if (!anthropicApiKey) {
        return c.json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
      }

      try {
        // Create Vercel Sandbox
        const result = await createSandbox({
          repoUrl,
          branch,
          githubToken,
          anthropicApiKey,
        });

        // Check if we got a sandbox URL - this is required for the session to work
        if (!result.sandboxUrl) {
          await updateSessionStatus(
            sessionId,
            "error",
            result.sandboxId,
            undefined,
            undefined,
            "Failed to establish connection to sandbox - no URL available"
          );

          return c.json(
            {
              error: "Failed to establish connection to sandbox",
              sandboxId: result.sandboxId,
            },
            500
          );
        }

        // Store OpenCode client
        openCodeClients.set(sessionId, new OpenCodeClient(result.sandboxUrl));

        // Update session with sandbox info - only set to running if we have a working connection
        await updateSessionStatus(
          sessionId,
          "running",
          result.sandboxId,
          result.sandboxUrl,
          result.previewUrl
        );

        return c.json({
          success: true,
          sandboxId: result.sandboxId,
          sandboxUrl: result.sandboxUrl,
          previewUrl: result.previewUrl,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Session creation error:", error);
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

        // Update session with error (don't await to avoid blocking response)
        updateSessionStatus(sessionId, "error", undefined, undefined, undefined, message).catch(
          (err) => console.error("Failed to update session status:", err)
        );

        return c.json({ error: message }, 500);
      }
    }
  );

  // Send a message to a session
  app.post(
    "/:id/message",
    zValidator(
      "json",
      z.object({
        content: z.string(),
      })
    ),
    async (c) => {
      const sessionId = c.req.param("id");
      const { content } = c.req.valid("json");

      const client = openCodeClients.get(sessionId);
      if (!client) {
        return c.json({ error: "Session not found or not running" }, 404);
      }

      // Set up SSE stream
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullContent = "";
          const toolCalls: unknown[] = [];
          const toolResults: unknown[] = [];

          try {
            await client.sendMessage(content, (event: StreamEvent) => {
              // Send event to client
              const data = JSON.stringify(event);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              // Accumulate content
              if (event.type === "text") {
                fullContent += event.data as string;
              } else if (event.type === "tool_call") {
                toolCalls.push(event.data);
              } else if (event.type === "tool_result") {
                toolResults.push(event.data);
              } else if (event.type === "done") {
                // Save assistant message to Convex (fire and forget)
                addMessage(
                  sessionId,
                  "assistant",
                  fullContent,
                  toolCalls.length > 0 ? toolCalls : undefined,
                  toolResults.length > 0 ? toolResults : undefined
                ).catch((err) => console.error("Failed to add message:", err));

                // Update session status to idle (fire and forget)
                updateSessionStatus(sessionId, "idle").catch((err) =>
                  console.error("Failed to update session status:", err)
                );
              }
            });

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", data: message })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream);
    }
  );

  // Stop a session
  app.post("/:id/stop", async (c) => {
    const sessionId = c.req.param("id");

    const client = openCodeClients.get(sessionId);

    try {
      // Get session from Convex to get sandbox ID
      const session = await convex.query(sessionsGet, {
        id: sessionId,
      });

      if (session?.sandboxId) {
        // Stop OpenCode first
        if (client) {
          await client.stop();
          openCodeClients.delete(sessionId);
        }

        // Terminate sandbox
        await terminateSandbox(session.sandboxId);
      }

      // Update session status
      await updateSessionStatus(sessionId, "stopped");

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  // Delete a session
  app.delete("/:id", async (c) => {
    const sessionId = c.req.param("id");

    const client = openCodeClients.get(sessionId);

    try {
      // Get session from Convex to get sandbox ID
      const session = await convex.query(sessionsGet, {
        id: sessionId,
      });

      // Stop OpenCode client if exists
      if (client) {
        try {
          await client.stop();
        } catch (error) {
          console.error(`Error stopping OpenCode client for session ${sessionId}:`, error);
        }
        openCodeClients.delete(sessionId);
      }

      // Terminate sandbox if it exists
      if (session?.sandboxId) {
        try {
          await terminateSandbox(session.sandboxId);
        } catch (error) {
          console.error(`Error terminating sandbox ${session.sandboxId}:`, error);
          // Continue with deletion even if sandbox termination fails
        }
      }

      // Delete session from Convex (this will also delete messages)
      await convex.mutation(sessionsDelete, { id: sessionId });

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error deleting session ${sessionId}:`, error);
      return c.json({ error: message }, 500);
    }
  });

  // Get session status
  app.get("/:id/status", async (c) => {
    const sessionId = c.req.param("id");

    try {
      const session = await convex.query(sessionsGet, {
        id: sessionId,
      });

      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      let sandboxStatus: "running" | "stopped" | "error" | null = null;
      if (session.sandboxId) {
        sandboxStatus = await getSandboxStatus(session.sandboxId);
      }

      return c.json({
        status: session.status,
        sandboxStatus,
        repoName: session.repoName,
        branch: session.branch,
        sandboxUrl: session.sandboxUrl,
        previewUrl: session.previewUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
