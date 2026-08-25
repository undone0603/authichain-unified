# Architectural Decoupling Plan

The current hybrid setup (Express+Vite in one process) is causing port conflicts and routing instability. This plan proposes a strict decoupling of frontend and backend.

## Objectives
1.  **Independent Frontend (Vite):** Frontend will run on port 5173.
2.  **Independent Backend (Express):** Backend will run on port 3001.
3.  **Proxying:** Vite will proxy `/api` requests to `http://localhost:3001`.

## Implementation Steps
1.  **Express Backend:** Create `server/index.ts` that only runs the Express server (no Vite middleware).
2.  **Vite Frontend:** Configure `vite.config.ts` for frontend-only development.
3.  **Scripts:** Update `package.json` to allow running them concurrently.
4.  **Verification:** Test API connectivity and UI rendering.
