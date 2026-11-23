// Included by the existing scripts/ci/*.test.mjs node --test CI runner.
// All fixtures are offline: no HTTP, secrets, A2A tasks, or paid calls.
import { selfTest } from '../alliances/a2a-card-offline-audit.mjs';

selfTest();
