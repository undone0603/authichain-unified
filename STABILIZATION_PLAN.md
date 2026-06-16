# Targeted Isolation Stabilization Plan (Option A)

## 1. Goal
Achieve reliable isolation for high-failure modules by refactoring them into testable adapters/repositories, instead of relying on the global database singleton (`getDb`).

## 2. Target Modules (Prioritized)
- **Missions Router (`server/missions/router.ts`)**
- **Admin Router (`server/admin/router.ts`)**

## 3. Implementation Pattern (Repository/Adapter)
- **Extract Logic:** Create a repository class/interface for the module (e.g., `MissionsRepository`).
- **Inject:** Use the TRPC context or a factory function to provide the repository to the router.
- **Mock:** In tests, provide a mock implementation of the repository interface.

## 4. Execution Steps (Example: Missions Module)
1. **Define Interface:** Create `server/missions/repository.ts` defining methods like `list`, `getById`, `create`.
2. **Implement:** Create `server/missions/db-repository.ts` which uses the existing `db.ts` queries.
3. **Refactor Router:** Update `router.ts` to accept the repository.
4. **Refactor Tests:** Update `missions.test.ts` to inject a `MockMissionsRepository`.
5. **Verify:** Confirm tests pass.
