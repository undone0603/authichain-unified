## Platform Robustness Directive (Pre-emptive Fixes)

To ensure application stability and maintain developer velocity, all contributors (including Gemini) MUST adhere to these patterns:

### 1. Robust Context Management (Fixes UI Crashes)
*   **Default Context Wrappers**: Any component using a custom `useX` hook MUST be exported with a default "Wrapper" component that includes its own provider if one is missing (e.g., `export function BrandWrapper({children}) { return <BrandProvider>{children}</BrandProvider> }`).
*   **Dev-Time Validation**: Custom `useX` hooks MUST implement dev-mode warnings:
    ```typescript
    export function useBrand() {
      const context = useContext(BrandContext);
      if (!context && process.env.NODE_ENV === 'development') {
        console.warn("useBrand must be used within a BrandProvider!");
      }
      return context;
    }
    ```

### 2. Strict Path Resolution (Fixes 'ENOENT')
*   **Eliminate '../' Navigation**: Never use relative paths like `../../` to escape directories. Always use absolute path aliases defined in `vite.config.ts` (e.g., `@/`, `@shared/`, `@assets/`).
*   **Centralized Path Resolver**: When dynamic paths are required in `server/`, utilize `path.resolve(import.meta.dirname, ...)` rather than manual string construction to prevent errors across build environments.

### 3. Pre-Flight Dependency Validation
*   **Automated Health Check**: Before starting the dev server, verify:
    *   Critical environment variables are set.
    *   Essential dependencies (`cors`, `express-rate-limit`, `structlog`) are installed in the `venv` or `node_modules`.
    *   Build artifacts exist (`dist/`).

### 4. Configuration Schema Validation (Zod)
*   **Env Var Enforcement**: Do not access `process.env` directly in application logic. Create a central `server/config.ts` that uses **Zod** to validate all required environment variables on startup.
*   **Fail-Fast**: If critical variables (e.g., `OAUTH_SERVER_URL`) are missing, log a clear error and `process.exit(1)` immediately.

### 5. Agentic Circuit Breaker Policy
*   **Time-Out Budgets**: Any `browser-use` agent MUST be instantiated with a hard timeout budget based on task type (e.g., Scout: 60s, Outreach: 120s). 
*   **Resilience Loops**: Wrap critical agentic tasks in a circuit breaker pattern (using `tenacity` for Python or `p-retry` for Node.js) to prevent cascaded failures.

### 6. Integration "Smoke Tests"
*   **Startup Verification**: Before serving traffic, the server must perform a "smoke test" verifying connectivity to:
    1.  The Supabase instance (ping).
    2.  The presence of mandatory static assets (e.g., `client/index.html`).
*   **CI/CD Guardrail**: Build scripts must run these smoke tests; if they fail, the deployment MUST be aborted.
