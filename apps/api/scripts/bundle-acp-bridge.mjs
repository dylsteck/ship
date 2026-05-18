/**
 * Bundle `packages/acp-bridge` into `src/generated/acp-bridge-bundled.ts` for sandbox injection.
 */
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const entry = path.join(repoRoot, 'packages/acp-bridge/src/server.ts')
const outFile = path.join(__dirname, '../src/generated/acp-bridge-bundled.ts')

const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  write: false,
  logLevel: 'warning',
})

const code = result.outputFiles[0]?.text
if (!code) {
  console.error('esbuild produced no output')
  process.exit(1)
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
const header = `/**\n * Bundled ship-acp-bridge (E2B /tmp drop-in).\n * Regenerate: pnpm exec node apps/api/scripts/bundle-acp-bridge.mjs\n */\n`
fs.writeFileSync(outFile, `${header}export const ACP_BRIDGE_BUNDLE: string = ${JSON.stringify(code)}\n`)
console.error(`[bundle-acp-bridge] wrote ${outFile} (${code.length} bytes)`)
