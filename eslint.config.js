import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'android', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // Architecture en couches (docs/DESIGN.md §10.3) : le cœur métier ne dépend
    // ni de l'interface, ni de l'audio, ni du stockage, ni de la plateforme.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(ui|audio|data|platform)(/|$)',
              message: 'src/core ne doit pas importer ui, audio, data ou platform (§10.3).',
            },
            {
              group: ['react', 'react-dom', 'react-dom/*', 'react-router'],
              message: 'src/core ne doit pas dépendre de React (§10.3).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
]);
