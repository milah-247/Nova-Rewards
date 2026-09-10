const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: ['node_modules/', '.next/', 'coverage/', 'dist/', 'build/', '.storybook/', 'storybook-static/', 'eslint.config.js', '.eslintrc.js', '.eslintrc.json'],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    // #1302: two `async headers()` keys in one object literal silently overwrote
    // each other, dropping the CSP and every static-asset Cache-Control rule from
    // production responses. Nothing surfaced it — `next build` is silent and the
    // shipped config extends only next/core-web-vitals, which does not turn this on.
    //
    // The issue assumed `no-dupe-keys` does not cover object *methods*. It does:
    // ESLint reports "Duplicate key 'headers'" for the exact shorthand-method
    // pattern that caused this bug, so enabling the rule is the whole fix.
    rules: {
      'no-dupe-keys': 'error',
    },
  },
];
