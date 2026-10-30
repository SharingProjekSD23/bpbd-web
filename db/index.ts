import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

const globalDb = globalThis as typeof globalThis & { bpbdPool?: Pool };
export function getPool() {
  if (!process.env.PGDATABASE || !process.env.PGUSER) {
    throw new Error('Konfigurasi PostgreSQL belum diisi. Lengkapi .env.local lalu jalankan npm run db:setup.');
  }
  return globalDb.bpbdPool ??= new Pool({ max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}
export function getDb() { return drizzle(getPool(), { schema }); }
