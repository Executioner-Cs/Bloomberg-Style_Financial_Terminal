'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@terminal/eslint-config'],
  parserOptions: {
    // tsconfig.node.json includes vite.config.ts (Node/build tooling files)
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      // E2E test files use Playwright's fluent API which returns promise-chains
      // that TypeScript-ESLint cannot fully resolve without a dedicated tsconfig
      // wired to @playwright/test type declarations. Disable type-checked rules
      // for E2E files — correctness is verified by running `pnpm test:e2e`.
      files: ['e2e/**/*.ts', 'e2e/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
  ],
};
