import { getPool } from '../db/index.ts';
try {
  const pool = getPool();
  const info = await pool.query('SELECT current_database() AS database, current_user AS username');
  const counts = await pool.query(`SELECT (SELECT count(*) FROM bpbd_users)::int AS users,
    (SELECT count(*) FROM bpbd_entries)::int AS entries, (SELECT count(*) FROM bpbd_research)::int AS research,
    (SELECT count(*) FROM bpbd_files)::int AS files`);
  console.log(JSON.stringify({ ...info.rows[0], ...counts.rows[0] }, null, 2));
} catch (error) { console.error(`Koneksi gagal: ${(error as Error).message}`); process.exitCode = 1; }
finally { await getPool().end().catch(() => {}); }
