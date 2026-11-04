import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
const originalDatabase = process.argv[2];
if (!originalDatabase || originalDatabase === process.env.PGDATABASE) throw new Error('Berikan nama database K2 sebelum integrasi yang berbeda dari database aktif.');
const original = new pg.Client({database:originalDatabase}), merged = new pg.Client();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  await original.connect(); await merged.connect();
  await original.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await merged.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const protectedTables = ['bpbd_users','bpbd_entries','bpbd_research','bpbd_reports','bpbd_imports','bpbd_meta','bpbd_files','bpbd_research_reminders'];
  const protectedData = [];
  for (const table of protectedTables) {
    const query = `SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`;
    const a = (await original.query(query)).rows, b = (await merged.query(query)).rows;
    protectedData.push({table,original:a.length,integrated:b.length,unchanged:digest(a)===digest(b)});
  }
  if (protectedData.some(r=>!r.unchanged)) throw new Error('Data K2 berbeda dari sumber; rekonsiliasi sebelum mengganti database.');
  const counts = (await merged.query('SELECT module,count(*)::int AS count FROM bpbd_op_records GROUP BY module ORDER BY module')).rows;
  const maps = (await merged.query('SELECT source,count(*)::int AS count FROM bpbd_source_map GROUP BY source ORDER BY source')).rows;
  const files = (await merged.query('SELECT sha256,content FROM bpbd_source_files UNION ALL SELECT sha256,content FROM bpbd_op_files')).rows;
  if (files.some(f=>createHash('sha256').update(f.content).digest('hex')!==f.sha256)) throw new Error('Checksum berkas tidak cocok.');
  const migration = JSON.parse(await readFile('backups/migration-report.json','utf8'));
  for (const row of counts) if (migration.counts[row.module] !== row.count) throw new Error('Jumlah catatan berbeda dari laporan migrasi.');
  const report = {at:new Date().toISOString(),protectedData,counts,maps,filesVerified:files.length};
  await writeFile('backups/verification-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally { await original.end(); await merged.end(); }
