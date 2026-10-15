import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'mock-api/data.json']),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      'arrow-body-style': ['warn', 'as-needed'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/jsx-key': 'warn',
      'react/self-closing-comp': ['error', { component: true, html: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['mock-api/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
]);

export default eslintConfig;
