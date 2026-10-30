import { test as base, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { seedStore } from '../../lib/bpbd/model';
import { writeStore } from '../../lib/server/repository';

// An automatic fixture runs for every test, including specs that share the
// same worker/module cache. A hook registered during import only attached to
// the first spec and let disabled accounts leak into the following spec.
export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [async ({}, use) => {
  // Browser workflows require the isolated database created by test:postgres.
  if (process.env.BPBD_INTEGRATION_TEST !== '1' || !/^bpbd_test_[a-f0-9]+$/.test(process.env.PGDATABASE || '')) {
    throw new Error('Jalankan npm run build lalu npm run test:postgres. Tes tidak dijalankan pada database pengguna.');
  }
  const pool = new Pool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM bpbd_sessions');
    await client.query('DELETE FROM bpbd_files');
    await client.query('DELETE FROM bpbd_research');
    for (const table of ['bpbd_users','bpbd_entries','bpbd_reports','bpbd_imports','bpbd_audit','bpbd_meta']) await client.query(`DELETE FROM ${table}`);
    await writeStore(client, null, seedStore());
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
  await use();
  }, { auto: true }],
});
export { expect, type Page };
