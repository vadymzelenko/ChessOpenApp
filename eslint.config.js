// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
    ],
  },
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/mobile/tsconfig.json', 'packages/*/tsconfig.json'],
        },
      },
    },
  },
  {
    rules: {
      // Fires on the documented i18next API (i18n.use / i18n.changeLanguage).
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
