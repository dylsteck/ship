import { ModalClient } from "modal";

// Initialize Modal client
const modal = new ModalClient();

// Store active sandboxes (using any since the SDK types may be incomplete)
const activeSandboxes = new Map<string, any>();

export interface SandboxConfig {
  repoUrl: string;
  branch: string;
  githubToken: string;
  anthropicApiKey: string;
}

export interface SandboxResult {
  sandboxId: string;
  tunnelUrl?: string;
}

export async function createSandbox(config: SandboxConfig): Promise<SandboxResult> {
  const { repoUrl, branch, githubToken, anthropicApiKey } = config;

  // Get or create app
  const app = await modal.apps.fromName("ship-agent", { createIfMissing: true });

  // Create a basic image
  const image = modal.images.fromRegistry("node:22-bookworm");

  // Create sandbox
  const sb = await modal.sandboxes.create(app, image, {
    timeoutMs: 3600 * 1000, // 1 hour max
  });

  // Generate a unique ID for this sandbox
  const sandboxId = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  activeSandboxes.set(sandboxId, sb);

  // Set environment variables
  await sb.exec([
    "sh",
    "-c",
    `export GITHUB_TOKEN="${githubToken}" && export ANTHROPIC_API_KEY="${anthropicApiKey}"`,
  ]);

  // Install dependencies
  await sb.exec(["apt-get", "update"]);
  await sb.exec(["apt-get", "install", "-y", "git", "curl"]);

  // Clone the repository
  const cloneUrl = repoUrl.replace("https://", `https://${githubToken}@`);
  await sb.exec([
    "git",
    "clone",
    "--branch",
    branch,
    "--single-branch",
    cloneUrl,
    "/workspace",
  ]);

  // Configure git
  await sb.exec(["git", "config", "--global", "user.email", "ship-agent@example.com"]);
  await sb.exec(["git", "config", "--global", "user.name", "Ship Agent"]);

  // Install OpenCode globally
  await sb.exec(["npm", "install", "-g", "@opencode-ai/opencode"]);

  // Start OpenCode server in background
  await sb.exec([
    "sh",
    "-c",
    `ANTHROPIC_API_KEY="${anthropicApiKey}" nohup opencode server --port 4096 --dir /workspace > /tmp/opencode.log 2>&1 &`,
  ]);

  // Try to get tunnel URL
  let tunnelUrl: string | undefined;
  try {
    const tunnels = await sb.tunnels(5000);
    if (tunnels && tunnels[4096]) {
      tunnelUrl = tunnels[4096].url;
    }
  } catch {
    console.warn("Could not create tunnel for sandbox");
  }

  return {
    sandboxId,
    tunnelUrl,
  };
}

export async function execInSandbox(sandboxId: string, command: string[]): Promise<string> {
  const sb = activeSandboxes.get(sandboxId);
  if (!sb) {
    throw new Error(`Sandbox ${sandboxId} not found`);
  }
  const result = await sb.exec(command);
  return await result.stdout.readText();
}

export async function terminateSandbox(sandboxId: string): Promise<void> {
  const sb = activeSandboxes.get(sandboxId);
  if (sb) {
    await sb.terminate();
    activeSandboxes.delete(sandboxId);
  }
}

export async function getSandboxStatus(
  sandboxId: string
): Promise<"running" | "stopped" | "error"> {
  const sb = activeSandboxes.get(sandboxId);
  if (!sb) {
    return "stopped";
  }
  try {
    await sb.exec(["echo", "ping"]);
    return "running";
  } catch {
    activeSandboxes.delete(sandboxId);
    return "stopped";
  }
}
