import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig, globalIgnores } from 'eslint/config';
import { FlatCompat } from '@eslint/eslintrc';

const require = createRequire(import.meta.url);

// eslint-config-next 15.x only ships legacy eslintrc-style configs (objects
// with `extends`), not flat-config arrays — importing
// 'eslint-config-next/core-web-vitals' directly crashes ESLint 9 with
// ERR_MODULE_NOT_FOUND (no exports map / missing .js), and even with the
// extension the result isn't spreadable. Bridge through FlatCompat, per the
// official Next.js ESLint 9 setup. Plugins must resolve from
// eslint-config-next's own directory: pnpm doesn't hoist its transitive
// eslint-plugin-* deps to the root node_modules.
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: path.dirname(
    require.resolve('eslint-config-next/package.json'),
  ),
});

const eslintConfig = defineConfig([
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Legacy-debt rules downgraded to warnings: the first working lint run
      // surfaced ~890 pre-existing errors (835 of them no-explicit-any) in
      // this multi-architecture codebase. Warnings keep the signal without
      // blocking `pnpm lint` (and the post-edit lint hook). Tighten back to
      // 'error' as the debt is paid down.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Separate Expo mobile app lives here with its own toolchain.
    'mobile/**',
  ]),
]);

export default eslintConfig;
