import tseslint from 'typescript-eslint'

const maxLinesRule = ['warn', { max: 300, skipBlankLines: true, skipComments: true }]
const maxLinesPerFunctionRule = ['warn', { max: 100, skipBlankLines: true, skipComments: true }]

export default tseslint.config(
  { ignores: ['**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'max-lines': maxLinesRule,
      'max-lines-per-function': maxLinesPerFunctionRule,
    },
  },
)
