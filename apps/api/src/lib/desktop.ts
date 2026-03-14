/**
 * E2B Desktop Stream Helpers
 *
 * Manages desktop streaming lifecycle using @e2b/desktop SDK.
 * The stream provides an interactive noVNC desktop accessible via iframe.
 */

import { Sandbox as DesktopSandbox } from '@e2b/desktop'

export async function startDesktopStream(
  apiKey: string,
  sandboxId: string,
): Promise<{ streamUrl: string; authKey: string }> {
  const desktop = await DesktopSandbox.connect(sandboxId, { apiKey })
  await desktop.stream.start({ requireAuth: true })
  const authKey = desktop.stream.getAuthKey()
  const streamUrl = desktop.stream.getUrl({ authKey })
  return { streamUrl, authKey }
}

export async function stopDesktopStream(
  apiKey: string,
  sandboxId: string,
): Promise<void> {
  const desktop = await DesktopSandbox.connect(sandboxId, { apiKey })
  await desktop.stream.stop()
}
