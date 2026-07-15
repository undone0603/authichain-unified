# Configuration Standardization Plan

The current `package.json` and `tsconfig.json` are suffering from configuration conflict due to a hybrid architecture (Next.js vs. Express/Vite). This causes inconsistent behavior and slow build times.

## Objectives
1.  **Architectural Unification:** Remove Next.js remnants to enforce the Vite-based SPA architecture.
2.  **Configuration Sanitization:** Clean `tsconfig.json` to reflect the actual project structure.
3.  **Build Optimization:** Streamline `package.json` scripts and dependency tree.

## Implementation Steps
1.  **TSConfig Sanitization:** Remove Next.js specific plugins and ensure `paths` mapping is unambiguous.
2.  **Dependencies Cleanup:** Identify and remove unused Next.js-related packages (e.g., `@supabase/auth-helpers-nextjs`, `next-auth`).
3.  **Scripts Normalization:** Standardize `dev`, `build`, and `start` scripts.

## Verification
- Run `npm run check` (TypeScript check) to verify resolution.
- Ensure Vite development server and production build target work correctly.
