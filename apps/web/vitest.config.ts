import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      '@ship/contracts': path.resolve(import.meta.dirname, '../../packages/contracts/src/index.ts'),
    },
  },
})
