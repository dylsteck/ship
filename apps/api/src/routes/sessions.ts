import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createSandbox, terminateSandbox, getSandboxStatus } from "../modal.js";
import { OpenCodeClient, type StreamEvent } from "../opencode.js";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

// Function references for Convex API
const sessionsInternalUpdateStatus = makeFunctionReference<
  "mutation",
  { id: string; status: string; modalSandboxId?: string; errorMessage?: string },
  void
>("sessions:internalUpdateStatus");

const sessionsGet = makeFunctionReference<
  "query",
  { id: string },
  { modalSandboxId?: string; status: string; repoName: string; branch: string } | null
>("sessions:get");

const messagesInternalAdd = makeFunctionReference<
  "mutation",
  { sessionId: string; role: string; content: string; toolCalls?: unknown[]; toolResults?: unknown[] },
  string
>("messages:internalAdd");

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
        // Create Modal sandbox
        const result = await createSandbox({
          repoUrl,
          branch,
          githubToken,
          anthropicApiKey,
        });

        // Check if we got a tunnel URL - this is required for the session to work
        if (!result.tunnelUrl) {
          await convex.mutation(sessionsInternalUpdateStatus, {
            id: sessionId,
            status: "error",
            modalSandboxId: result.sandboxId,
            errorMessage: "Failed to establish connection to sandbox - no tunnel URL available",
          });

          return c.json({
            error: "Failed to establish connection to sandbox",
            sandboxId: result.sandboxId,
          }, 500);
        }

        // Store OpenCode client
        openCodeClients.set(sessionId, new OpenCodeClient(result.tunnelUrl));

        // Update session with sandbox ID - only set to running if we have a working connection
        await convex.mutation(sessionsInternalUpdateStatus, {
          id: sessionId,
          status: "running",
          modalSandboxId: result.sandboxId,
        });

        return c.json({
          success: true,
          sandboxId: result.sandboxId,
          tunnelUrl: result.tunnelUrl,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        // Update session with error
        await convex.mutation(sessionsInternalUpdateStatus, {
          id: sessionId,
          status: "error",
          errorMessage: message,
        });

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
                // Save assistant message to Convex
                convex.mutation(messagesInternalAdd, {
                  sessionId,
                  role: "assistant",
                  content: fullContent,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                  toolResults: toolResults.length > 0 ? toolResults : undefined,
                });

                // Update session status to idle
                convex.mutation(sessionsInternalUpdateStatus, {
                  id: sessionId,
                  status: "idle",
                });
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

      if (session?.modalSandboxId) {
        // Stop OpenCode first
        if (client) {
          await client.stop();
          openCodeClients.delete(sessionId);
        }

        // Terminate sandbox
        await terminateSandbox(session.modalSandboxId);
      }

      // Update session status
      await convex.mutation(sessionsInternalUpdateStatus, {
        id: sessionId,
        status: "stopped",
      });

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
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
      if (session.modalSandboxId) {
        sandboxStatus = await getSandboxStatus(session.modalSandboxId);
      }

      return c.json({
        status: session.status,
        sandboxStatus,
        repoName: session.repoName,
        branch: session.branch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
