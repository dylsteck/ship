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

const OPENCODE_PORT = 4096;

export async function createSandbox(config: SandboxConfig): Promise<SandboxResult> {
  const { repoUrl, branch, githubToken, anthropicApiKey } = config;

  // Get or create app
  const app = await modal.apps.fromName("ship-agent", { createIfMissing: true });

  // Create a basic image
  const image = modal.images.fromRegistry("node:22-bookworm");

  // Create ephemeral secrets for environment variables
  const envSecrets = await modal.secrets.fromObject({
    GITHUB_TOKEN: githubToken,
    ANTHROPIC_API_KEY: anthropicApiKey,
  });

  // Create sandbox with encrypted port for tunneling
  const sb = await modal.sandboxes.create(app, image, {
    timeoutMs: 3600 * 1000, // 1 hour max
    encryptedPorts: [OPENCODE_PORT],
    secrets: [envSecrets],
  });

  // Generate a unique ID for this sandbox
  const sandboxId = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  activeSandboxes.set(sandboxId, sb);

  console.log(`Sandbox created: ${sandboxId}`);

  // Install dependencies
  console.log("Installing dependencies...");
  await sb.exec(["apt-get", "update"]);
  await sb.exec(["apt-get", "install", "-y", "git", "curl"]);

  // Clone the repository
  console.log(`Cloning repository: ${repoUrl} (branch: ${branch})`);
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

  // Configure git for Ship commits
  await sb.exec(["git", "config", "--global", "user.email", "ship@ship.dev"]);
  await sb.exec(["git", "config", "--global", "user.name", "Ship"]);

  // Install OpenCode globally
  console.log("Installing OpenCode...");
  await sb.exec(["npm", "install", "-g", "@opencode-ai/opencode"]);

  // Start OpenCode server in background
  console.log("Starting OpenCode server...");
  await sb.exec([
    "sh",
    "-c",
    `nohup opencode server --port ${OPENCODE_PORT} --dir /workspace > /tmp/opencode.log 2>&1 &`,
  ]);

  // Wait for OpenCode server to start
  console.log("Waiting for OpenCode server to start...");
  await sleep(3000);

  // Get tunnel URL
  let tunnelUrl: string | undefined;
  try {
    console.log("Getting tunnel information...");
    const tunnels = await sb.tunnels();

    if (tunnels && tunnels[OPENCODE_PORT]) {
      tunnelUrl = tunnels[OPENCODE_PORT].url;
      console.log(`Tunnel URL: ${tunnelUrl}`);
    } else {
      console.warn("No tunnel available for port", OPENCODE_PORT);
      console.log("Available tunnels:", Object.keys(tunnels || {}));
    }
  } catch (error) {
    console.error("Could not create tunnel for sandbox:", error);

    // Try to get OpenCode logs for debugging
    try {
      const logResult = await sb.exec(["cat", "/tmp/opencode.log"], { stdout: "pipe" });
      const logs = await logResult.stdout.readText();
      console.log("OpenCode logs:", logs);
    } catch {
      console.warn("Could not read OpenCode logs");
    }
  }

  return {
    sandboxId,
    tunnelUrl,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function execInSandbox(sandboxId: string, command: string[]): Promise<string> {
  const sb = activeSandboxes.get(sandboxId);
  if (!sb) {
    throw new Error(`Sandbox ${sandboxId} not found`);
  }
  const result = await sb.exec(command, { stdout: "pipe" });
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
