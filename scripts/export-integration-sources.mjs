import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.argv[2]; if (!root) throw new Error('Berikan path folder Github sumber.');
await mkdir('backups/sources', { recursive: true });
const text = await readFile(join(root, 'Kelompok1/src/main/resources/application.properties'), 'utf8');
const props = Object.fromEntries(text.split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const url = process.env.SUPABASE_URL || props['supabase.url'];
const key = process.env.SUPABASE_KEY || props['supabase.key'];
const tables = ['master_barang', 'logistik_transaksi', 'kejadian_bencana', 'master_wilayah', 'permintaan_data', 'mitigasi_bencana', 'pascabencana'];
const data = {}, errors = [];
for (const table of tables) {
  try {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=*&offset=${offset}&limit=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const batch = await response.json(); if (!Array.isArray(batch)) throw new Error('Format bukan tabel.');
      rows.push(...batch); if (batch.length < 1000) break;
      if (offset >= 100000) throw new Error('Batas ekspor terlampaui; lanjutkan dengan ekspor database.');
    }
    data[table] = rows;
  } catch (e) { errors.push({ table, error: e.message.includes('HTTP') ? e.message : 'Sumber belum dapat diakses.' }); }
}
await writeFile('backups/sources/kelompok1.json', JSON.stringify(data));
const dir = join(root, 'Kelompok_3/data/v2/operasional'); const k3 = {};
for (const name of await readdir(dir)) if (name.endsWith('.json')) k3[name.slice(0, -5)] = JSON.parse(await readFile(join(dir, name), 'utf8'));
await writeFile('backups/sources/kelompok3.json', JSON.stringify(k3));
const report = { at: new Date().toISOString(), root, counts: { K1: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])), K3: Object.fromEntries(Object.entries(k3).map(([k, v]) => [k, v.length])) }, errors };
await writeFile('backups/sources/manifest.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counts: report.counts, errors }));
if (errors.length) process.exitCode = 2;
