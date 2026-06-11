/**
 * The canonical root router lives in ./routers/index.ts (39 sub-routers).
 * This file used to hold a stale, smaller duplicate that shadowed the
 * directory during module resolution; it now just re-exports the real one.
 */
export { appRouter, type AppRouter } from "./routers/index";
