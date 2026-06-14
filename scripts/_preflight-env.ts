// Side-effect module: load env files BEFORE anything that reads process.env
// (server/_core/env.ts captures process.env at import time). ESM evaluates
// imported modules in import order, so importing this first guarantees the
// env is populated before ENV/getDb are constructed.
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
