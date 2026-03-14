import { Template } from 'e2b'

export const template = Template()
  .fromImage('e2bdev/desktop')
  // Install common dev tools
  .runCmd('sudo apt-get update && sudo apt-get install -y --no-install-recommends git curl wget build-essential && sudo rm -rf /var/lib/apt/lists/*')
  // Install Node.js 20 (needed by sandbox-agent ACP agent processes at runtime)
  .runCmd('curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs && sudo rm -rf /var/lib/apt/lists/*')
  // Install sandbox-agent binary (agent installs happen at runtime — they need npm which hangs in build)
  .runCmd('curl -fsSL https://releases.rivet.dev/sandbox-agent/0.3.x/install.sh | sh')
