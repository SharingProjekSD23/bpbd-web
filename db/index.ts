import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

const globalDb = globalThis as typeof globalThis & { bpbdPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL && (!process.env.PGDATABASE || !process.env.PGUSER)) {
    throw new Error('Isi DATABASE_URL atau konfigurasi PG di environment PostgreSQL.');
  }
  return globalDb.bpbdPool ??= new Pool({
    ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
    max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000,
  });
}
export function getDb() { return drizzle(getPool(), { schema }); }
