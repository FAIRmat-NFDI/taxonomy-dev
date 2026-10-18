import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Model: plain TypeScript, no UI or state — so it can move to a backend later unchanged.
    files: ['src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', '@mui/*', '@emotion/*', '@reduxjs/*', '@tanstack/*'], message: 'api/ must not depend on UI or state libraries.' },
            { group: ['@/components/*', '@/pages/*', '@/hooks/*', '@/store', '@/store/*'], message: 'api/ must not depend on outer layers.' },
          ],
        },
      ],
    },
  },
  {
    // View: talks to GitHub/backend/RDF only through the @/api index, hooks/ and store/.
    files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['n3', '@/api/*'], message: 'Import from @/api (its public index) — never call libraries or api internals directly.' }] },
      ],
    },
  },
);
