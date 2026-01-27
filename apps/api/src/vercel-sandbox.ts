import { Sandbox } from "@vercel/sandbox";
import { getVercelOidcToken } from "@vercel/oidc";

// Store active sandboxes by session ID
const activeSandboxes = new Map<string, Sandbox>();

// Helper to get and log OIDC token (for copying to .env.local)
async function getAndLogOIDCToken(): Promise<string | undefined> {
  try {
    const token = await getVercelOidcToken();
    console.log("\n" + "=".repeat(80));
    console.log("VERCEL_OIDC_TOKEN (copy this to your .env.local):");
    console.log("=".repeat(80));
    console.log(token);
    console.log("=".repeat(80) + "\n");
    return token;
  } catch (error) {
    console.log("Could not get Vercel OIDC token (this is normal in local dev):", error);
    // Fall back to env var if available
    return process.env.VERCEL_OIDC_TOKEN;
  }
}

export interface SandboxConfig {
  repoUrl: string;
  branch: string;
  githubToken: string;
  anthropicApiKey: string;
}

export interface SandboxResult {
  sandboxId: string;
  sandboxUrl: string;
  previewUrl?: string;
}

const OPENCODE_PORT = 4096;
const PREVIEW_PORT = 3000;

export async function createSandbox(config: SandboxConfig): Promise<SandboxResult> {
  const { repoUrl, branch, githubToken, anthropicApiKey } = config;

  console.log(`Creating Vercel Sandbox for ${repoUrl} (branch: ${branch})`);

  // Try to get and log OIDC token (for copying to .env.local)
  await getAndLogOIDCToken();

  // Create sandbox with git source
  const sandbox = await Sandbox.create({
    runtime: "node22",
    resources: { vcpus: 4 },
    timeout: 60 * 60 * 1000, // 1 hour
    ports: [OPENCODE_PORT, PREVIEW_PORT],
  });

  const sandboxId = sandbox.sandboxId;
  activeSandboxes.set(sandboxId, sandbox);

  console.log(`Sandbox created: ${sandboxId}`);

  try {
    // Clone the repository (using token for auth)
    console.log("Cloning repository...");
    const cloneUrl = repoUrl.replace("https://", `https://${githubToken}@`);
    await sandbox.runCommand("git", ["clone", "--branch", branch, "--single-branch", cloneUrl, "/vercel/sandbox/workspace"]);

    // Configure git for Ship commits
    await sandbox.runCommand("git", ["config", "--global", "user.email", "ship@ship.dev"]);
    await sandbox.runCommand("git", ["config", "--global", "user.name", "Ship"]);

    // Install Bun (OpenCode requires it)
    console.log("Installing Bun...");
    await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "curl -fsSL https://bun.sh/install | bash"],
      sudo: true,
    });

    // Add Bun to PATH
    await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", 'echo "export BUN_INSTALL=\\"/root/.bun\\"" >> /root/.bashrc'],
      sudo: true,
    });
    await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", 'echo "export PATH=\\"/root/.bun/bin:\\$PATH\\"" >> /root/.bashrc'],
      sudo: true,
    });

    // Install OpenCode globally
    console.log("Installing OpenCode...");
    await sandbox.runCommand("npm", ["install", "-g", "opencode-ai"]);

    // Start OpenCode server in background (detached mode)
    console.log("Starting OpenCode server...");
    await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        `ANTHROPIC_API_KEY=${anthropicApiKey} nohup opencode serve --hostname 0.0.0.0 --port ${OPENCODE_PORT} --dir /vercel/sandbox/workspace > /tmp/opencode.log 2>&1 &`,
      ],
      detached: true,
    });

    // Wait for OpenCode server to start
    console.log("Waiting for OpenCode server to start...");
    await sleep(3000);

    // Get the sandbox URL for the OpenCode port
    const sandboxUrl = sandbox.domain(OPENCODE_PORT);
    let previewUrl: string | undefined;
    try {
      previewUrl = sandbox.domain(PREVIEW_PORT);
    } catch {
      // Preview port may not be available yet
    }

    console.log(`Sandbox URL: ${sandboxUrl}`);
    if (previewUrl) {
      console.log(`Preview URL: ${previewUrl}`);
    }

    return {
      sandboxId,
      sandboxUrl,
      previewUrl,
    };
  } catch (error) {
    console.error("Error setting up sandbox:", error);

    // Try to get OpenCode logs for debugging
    try {
      const logResult = await sandbox.runCommand("cat", ["/tmp/opencode.log"]);
      const logs = await logResult.stdout();
      console.log("OpenCode logs:", logs);
    } catch {
      console.warn("Could not read OpenCode logs");
    }

    // Clean up on error
    await terminateSandbox(sandboxId);
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function execInSandbox(sandboxId: string, command: string[]): Promise<string> {
  const sandbox = activeSandboxes.get(sandboxId);
  if (!sandbox) {
    throw new Error(`Sandbox ${sandboxId} not found`);
  }
  const result = await sandbox.runCommand(command[0], command.slice(1));
  return await result.stdout();
}

export async function terminateSandbox(sandboxId: string): Promise<void> {
  const sandbox = activeSandboxes.get(sandboxId);
  if (sandbox) {
    try {
      await sandbox.stop();
    } catch (error) {
      console.error(`Error stopping sandbox ${sandboxId}:`, error);
    }
    activeSandboxes.delete(sandboxId);
  }
}

export async function getSandboxStatus(
  sandboxId: string
): Promise<"running" | "stopped" | "error"> {
  const sandbox = activeSandboxes.get(sandboxId);
  if (!sandbox) {
    return "stopped";
  }
  try {
    const status = sandbox.status;
    if (status === "running") return "running";
    if (status === "stopped" || status === "stopping") return "stopped";
    return "error";
  } catch {
    activeSandboxes.delete(sandboxId);
    return "stopped";
  }
}

export function getSandbox(sandboxId: string): Sandbox | undefined {
  return activeSandboxes.get(sandboxId);
}
