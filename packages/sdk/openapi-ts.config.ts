import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '../../apps/api/openapi/ship-api.openapi.json',
  output: 'src/generated',
  plugins: ['@hey-api/typescript', '@hey-api/client-fetch', '@hey-api/sdk'],
})
