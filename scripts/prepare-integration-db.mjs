import { Client } from 'pg';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const source = process.env.PGDATABASE;
if (!source || !/^[a-z][a-z0-9_]{0,48}$/.test(source)) throw new Error('Nama database sumber tidak valid.');
const target = source + '_integrasi';
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir('backups', { recursive: true });
const backup = join(process.cwd(), 'backups', `sebelum-integrasi-${stamp}.dump`);
const result = spawnSync(join(bin, 'pg_dump.exe'), ['--format=custom', '--no-owner', '--file', backup], { env: process.env, windowsHide: true, encoding: 'utf8' });
if (result.status !== 0) throw new Error('Cadangan PostgreSQL gagal; database sumber tidak diubah.');
const admin = new Client({ database: 'postgres' }); await admin.connect();
try {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [target])).rowCount) throw new Error('Database integrasi sudah ada; hentikan agar tidak menimpa data.');
  await admin.query(`CREATE DATABASE "${target}"`);
} finally { await admin.end(); }
const restore = spawnSync(join(bin, 'pg_restore.exe'), ['--no-owner', '--exit-on-error', '--dbname', target, backup], { env: process.env, windowsHide: true, encoding: 'utf8' });
if (restore.status !== 0) throw new Error('Pemulihan ke database integrasi gagal. Database sumber tetap tersedia.');
const env = await readFile('.env.local', 'utf8');
await writeFile('.env.local', env.replace(/^PGDATABASE=.*$/m, `PGDATABASE=${target}`));
console.log(JSON.stringify({ backup, sourceDatabase: source, integrationDatabase: target, restored: true }));
