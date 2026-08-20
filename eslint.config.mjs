import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// eslint-config-next 16.x ships native flat-config arrays at these subpaths
// (./core-web-vitals, ./typescript), so we spread them directly. The previous
// FlatCompat bridge resolved plugins via require.resolve(
// 'eslint-config-next/package.json'), which 16.x's "exports" map no longer
// exposes — that crashed ESLint 9 with ERR_PACKAGE_PATH_NOT_EXPORTED and
// silently disabled linting during `next build`.
// Reuse the exact plugin instances the Next flat configs already registered
// (react, @typescript-eslint, @next/next, …) so our rule overrides below can
// reference their namespaces without re-importing/version-pinning each plugin.
const nextPlugins = Object.assign(
  {},
  ...[...nextCoreWebVitals, ...nextTypescript]
    .map((c) => c.plugins)
    .filter(Boolean),
);

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: nextPlugins,
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
      // React Compiler rules (new in eslint-plugin-react-hooks v6, pulled in by
      // eslint-config-next 16.x) default to 'error'. This React 18 app doesn't
      // run the compiler, so treat them as advisory warnings — otherwise these
      // pre-existing patterns would newly fail `next build`'s lint step. Fix
      // and promote back to 'error' incrementally.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    // Separate Expo mobile app lives here with its own toolchain.
    'mobile/**',
    // Independently managed applications and operational bundles have their own
    // toolchains; root lint covers only the deployable Next/server surface.
    '.ab-testing/**',
    'agentz/**',
    'api/**',
    'apps/**',
    'artifacts/**',
    'client/**',
    'contracts/**',
    'content/**',
    'docs/archive/**',
    'knowledge/**',
    'libs/**',
    'mcp/**',
    'packages/**',
    'protocol/**',
    'scripts/**',
    'worker/**',
    'worker-app/**',
    // Standalone Cloudflare Workers: each has its own toolchain/lockfile and
    // ships large single-file bundles (src/index.ts up to ~380 KB) that blow
    // ESLint's parser stack. They are deployed via `wrangler deploy`, not the
    // Next build, so they are out of scope for this config.
    'workers/**',
  ]),
]);

export default eslintConfig;
