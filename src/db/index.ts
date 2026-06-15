import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For edge compatibility, we might need a different driver, 
// but for standard Next.js on Vercel, postgres-js works.
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
