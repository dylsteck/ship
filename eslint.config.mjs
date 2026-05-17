import next from 'eslint-config-next/core-web-vitals'

const maxLinesRule = ['warn', { max: 300, skipBlankLines: true, skipComments: true }]
const maxLinesPerFunctionRule = ['warn', { max: 100, skipBlankLines: true, skipComments: true }]

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '.agents/skills/**',
    ],
  },
  ...next,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'max-lines': maxLinesRule,
      'max-lines-per-function': maxLinesPerFunctionRule,
      // React Compiler–style rules (eslint-plugin-react-hooks v7): keep hooks-of-hooks, relax the rest until refactors land
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      'max-lines': maxLinesRule,
      'max-lines-per-function': maxLinesPerFunctionRule,
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'max-lines': maxLinesRule,
      'max-lines-per-function': maxLinesPerFunctionRule,
    },
  },
]

export default eslintConfig
