# AgentZ Project Workspace

This directory is the canonical root for the AgentZ autonomous trust infrastructure.

## Structure
- `/client`: Frontend UI (Vite SPA)
- `/server`: Backend API (Express + tRPC)
- `/agentz`: Autonomous Agent core logic and workflows
- `/docs`: Project documentation, architectural plans, and robustness directives
- `/contracts`: Smart contract definitions

## Documentation Index
- [Master Conventions](/GEMINI.md)
- [Platform Robustness Directive](/docs/platform-robustness.md)
- [Architectural Decoupling Plan](/docs/decoupling.md)
- [Configuration Standardization Plan](/docs/config-standardization.md)

## Operational Tips
- **Run Development Environment:** `npm run dev`
- **Operations Console:** Available at `http://localhost:5173/admin/ops` (after starting dev server)
- **Deployment:** Use `pnpm run build`
