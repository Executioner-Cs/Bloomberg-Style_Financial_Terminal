'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@terminal/eslint-config'],
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
};
