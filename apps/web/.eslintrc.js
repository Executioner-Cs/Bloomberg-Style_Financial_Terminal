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
};
