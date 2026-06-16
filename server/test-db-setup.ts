import { vi } from 'vitest';
import { newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema';

// Create pg-mem instance
const memDb = newDb({
  autoCreateForeignKeyIndices: true,
});

// Configure pg-mem to behave like Postgres
memDb.public.none('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

// Adapter to use with Drizzle
const { Pool } = memDb.adapters.createPg();
const db = drizzle(new Pool(), { schema });

// Mock './db' to return this in-memory instance
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(db),
}));
