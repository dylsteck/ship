import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ConvexHttpClient } from "convex/browser";
import { createSessionRoutes } from "./routes/sessions.js";
import { createRepoRoutes } from "./routes/repos.js";

// Initialize Convex client
const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.warn("Warning: CONVEX_URL not set, some features may not work");
}
const convex = new ConvexHttpClient(convexUrl || "");

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3001", "https://*.vercel.app"],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get("/", (c) => {
  return c.json({
    name: "Ship API",
    version: "0.1.0",
    endpoints: [
      "GET /health",
      "POST /sessions",
      "GET /sessions/:id/status",
      "POST /sessions/:id/message",
      "POST /sessions/:id/stop",
      "GET /repos",
      "GET /repos/:owner/:repo/branches",
      "GET /repos/search",
    ],
  });
});

// Mount routes
app.route("/sessions", createSessionRoutes(convex));
app.route("/repos", createRepoRoutes());

// Error handling
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json(
    {
      error: err.message || "Internal server error",
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export default app;
