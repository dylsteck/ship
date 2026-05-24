#!/usr/bin/env tsx
/**
 * Export OpenAPI spec to apps/api/openapi/ship-api.openapi.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpenApiDocument } from '../src/openapi/build-spec'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../openapi/ship-api.openapi.json')

const doc = buildOpenApiDocument()
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`)
console.log(`Wrote ${outPath}`)
