'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@terminal/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
