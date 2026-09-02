# Technical Debt: Linting & Code Quality

This document tracks identified technical debt in the `authichain-unified` repository.

## Current State

- **Status:** Functional (Tests Passing)
- **Linting Warnings:** ~1,028 (0 Errors)

## Debt Categories

- [ ] **Type Safety:** Replace `any` types with proper interfaces/types (`@typescript-eslint/no-explicit-any`).
- [ ] **React Hooks:** Address `useEffect` dependency issues and synchronous state updates (`react-hooks/exhaustive-deps`, `react-hooks/set-state-in-effect`).
- [ ] **Dead Code:** Remove unused variables and imports (`@typescript-eslint/no-unused-vars`).
- [ ] **Next.js/React Best Practices:** Address image element usage (`@next/next/no-img-element`) and unescaped entities (`react/no-unescaped-entities`).
- [ ] **TypeScript Config:** Replace `@ts-ignore` with `@ts-expect-error` or fix underlying errors (`@typescript-eslint/ban-ts-comment`).

## Priority

1. **Type Safety & Hook Dependencies:** Critical for preventing regressions during future development.
2. **Dead Code & Best Practices:** Important for codebase maintainability and performance.

_Note: Addressing these should be done incrementally to avoid disrupting functional stability._
