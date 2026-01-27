import { Sandbox } from "@vercel/sandbox";
import { getVercelOidcToken } from "@vercel/oidc";

// Store active sandboxes by session ID
const activeSandboxes = new Map<string, Sandbox>();

// Helper to get and log OIDC token (for copying to .env.local)
async function getAndLogOIDCToken(): Promise<string | undefined> {
  try {
    const token = await getVercelOidcToken();
    // Set it as env var so Sandbox SDK can use it
    if (token) {
      process.env.VERCEL_OIDC_TOKEN = token;
    }
    return token;
  } catch (error) {
    console.log("Could not get Vercel OIDC token (this is normal in local dev):", error);
    // Fall back to env var if available
    const envToken = process.env.VERCEL_OIDC_TOKEN;
    if (envToken) {
      console.log("Using VERCEL_OIDC_TOKEN from environment");
    }
    return envToken;
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
  const oidcToken = await getAndLogOIDCToken();
  
  if (!oidcToken && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error("Vercel OIDC token not available. Sandbox creation requires authentication.");
  }

  // Create sandbox with git source
  let sandbox;
  try {
    console.log("Calling Sandbox.create()...");
    console.log("VERCEL_OIDC_TOKEN available:", !!process.env.VERCEL_OIDC_TOKEN);
    
    // For GitHub authentication, use "git" as username and token as password
    // This is the standard way to authenticate with GitHub using tokens
    sandbox = await Sandbox.create({
      runtime: "node22",
      resources: { vcpus: 4 },
      timeout: 45 * 60 * 1000, // 45 minutes (max for Hobby plan, can extend later)
      ports: [OPENCODE_PORT, PREVIEW_PORT],
      source: {
        type: "git",
        url: repoUrl,
        username: "git",
        password: githubToken,
        revision: branch, // Specify the branch to checkout
      },
    });
    
    console.log("Sandbox.create() succeeded");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Failed to create sandbox:", errorMessage);
    if (errorStack) {
      console.error("Error stack:", errorStack);
    }
    // Include more details in error message
    throw new Error(`Failed to create Vercel Sandbox: ${errorMessage}${errorStack ? `\n${errorStack}` : ""}`);
  }

  const sandboxId = sandbox.sandboxId;
  activeSandboxes.set(sandboxId, sandbox);

  console.log(`Sandbox created: ${sandboxId}`);

  try {
    // Repository is already cloned by Sandbox.create() with source parameter
    // The working directory should be /vercel/sandbox
    console.log("Repository cloned via source parameter");

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
    // When using source parameter, repo is cloned to /vercel/sandbox
    // Check what directory was created
    console.log("Determining workspace directory...");
    const listResult = await sandbox.runCommand("ls", ["-la", "/vercel/sandbox"]);
    const lsOutput = await listResult.stdout();
    console.log("Contents of /vercel/sandbox:", lsOutput);
    
    // Extract repo name from URL (e.g., "https://github.com/dylsteck/5792-decoder.git" -> "5792-decoder")
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'workspace';
    // Try the repo name directory first, fallback to /vercel/sandbox
    const workspaceDir = `/vercel/sandbox/${repoName}`;
    
    console.log(`Starting OpenCode server in ${workspaceDir}...`);
    await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        `ANTHROPIC_API_KEY=${anthropicApiKey} nohup opencode serve --hostname 0.0.0.0 --port ${OPENCODE_PORT} --dir ${workspaceDir} > /tmp/opencode.log 2>&1 &`,
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
  let sandbox = activeSandboxes.get(sandboxId);
  
  // If sandbox not in memory, try to retrieve it by ID
  if (!sandbox) {
    try {
      console.log(`Sandbox ${sandboxId} not in memory, retrieving from Vercel...`);
      sandbox = await Sandbox.get({ sandboxId });
      console.log(`Retrieved sandbox ${sandboxId} from Vercel`);
    } catch (error) {
      console.error(`Could not retrieve sandbox ${sandboxId}:`, error);
      // Sandbox might already be stopped or deleted
      activeSandboxes.delete(sandboxId);
      return;
    }
  }

  if (sandbox) {
    try {
      console.log(`Stopping sandbox ${sandboxId}...`);
      await sandbox.stop();
      console.log(`Sandbox ${sandboxId} stopped successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error stopping sandbox ${sandboxId}:`, errorMessage);
      // Continue even if stop fails - sandbox might already be stopped
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
