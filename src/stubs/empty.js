// Generic stub for CJS-only packages that cannot run on CF Workers.
// Provides both default and named exports so that packages like pino,
// ioredis, redis, playwright-core, chromium-bidi, jimp can be imported
// with any named import syntax without causing build failures.
export default {};
export const noop = () => {};
export const pino = noop;
export const levels = noop;
export const chromium = noop;
export const chromiumBidi = noop;
export const ioredis = noop;
export const redis = noop;
export const jimp = noop;
export const playwrightCore = noop;
export const logger = noop;
export const createLogger = noop;
export const makeLogger = noop;
export const Stdout = noop;
export const Pino = noop;
export const Logger = noop;
