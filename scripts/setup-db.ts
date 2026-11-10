import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from '../db/index.ts';
import { seedStore } from '../lib/bpbd/model.ts';
import { writeStore } from '../lib/server/repository.ts';

async function main() {
  // Cloud databases are provisioned by the provider; do not CREATE DATABASE there.
  if (!process.env.DATABASE_URL) {
    const database = process.env.PGDATABASE;
    if (!database || !/^[a-z][a-z0-9_]{0,62}$/.test(database)) throw new Error('PGDATABASE harus nama database sederhana, misalnya bpbd_local.');
    const admin = new pg.Client({ database: 'postgres', connectionTimeoutMillis: 5000 });
    try {
      await admin.connect();
      const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
      if (!exists.rowCount) {
        await admin.query(`CREATE DATABASE "${database}"`);
        console.log(`Database ${database} dibuat.`);
      } else console.log(`Database ${database} sudah tersedia; data yang ada dipertahankan.`);
    } finally { await admin.end(); }
  }
  await migrate(getDb(), { migrationsFolder: './drizzle/postgresql' });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile('sql/integrasi.sql', 'utf8'));
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-initial-seed'))");
    const ready = await client.query('SELECT 1 FROM bpbd_meta WHERE id=1');
    if (!ready.rowCount) {
      await writeStore(client, null, seedStore());
      console.log('Akun dan data contoh awal disimpan. Password akun disimpan sebagai hash scrypt.');
    } else console.log('Data awal sudah ada; seed tidak diulang.');
    await client.query('COMMIT');
    console.log('Skema PostgreSQL siap digunakan.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
try { await main(); }
catch (error) { console.error(`Setup gagal: ${(error as Error).message}`); process.exitCode = 1; }
finally { await getPool().end().catch(() => {}); }
