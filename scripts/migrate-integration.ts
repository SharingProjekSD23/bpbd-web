import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { getPool } from '../db/index.ts';
import { modules, type Row, stockOf, checkStock } from '../lib/operations/domain.ts';
import { readRecords, saveRecord } from '../lib/operations/repository.ts';

const sourceDir = process.argv[2] || 'backups/sources';
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const k1 = JSON.parse(await readFile(join(sourceDir, 'kelompok1.json'), 'utf8')) as Record<string, Record<string, unknown>[]>;
const k3 = JSON.parse(await readFile(join(sourceDir, 'kelompok3.json'), 'utf8')) as Record<string, Row[]>;
const manifest = JSON.parse(await readFile(join(sourceDir, 'manifest.json'), 'utf8')) as { root: string; errors: unknown[]; preview?: { activated: boolean; file: string; sha256: string; conflicts: string[] } };
const preview: Record<string, Row[]> = manifest.preview?.activated ? JSON.parse(await readFile(join(sourceDir, 'kelompok3-preview.json'), 'utf8')) : {};
if (manifest.errors.length) throw new Error('Sumber belum lengkap. Periksa manifest ekspor sebelum migrasi.');
const client = await getPool().connect();
const sourceId = (entity: string, row: Record<string, unknown>) => String(row.id ?? row[({ master_barang: 'barang_id', logistik_transaksi: 'transaksi_id', kejadian_bencana: 'kejadian_id', master_wilayah: 'wilayah_id', permintaan_data: 'request_id', mitigasi_bencana: 'mitigasi_id', pascabencana: 'pasca_id' } as Record<string, string>)[entity]] ?? '');
try {
  await client.query('BEGIN'); await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-operasional'))");
  await client.query(await readFile('sql/integrasi.sql', 'utf8'));
  const records = await readRecords(client);
  const aliases = new Map<string, string>();
  for (const map of (await client.query('SELECT * FROM bpbd_source_map')).rows) aliases.set(`${map.source}/${map.entity}/${map.source_id}`, map.record_id);
  async function archive(source: string, entity: string, id: string, row: Record<string, unknown>) {
    if (!id) throw new Error(`ID sumber tidak tersedia: ${source}/${entity}.`);
    const json = JSON.stringify(row), digest = hash(json);
    const old = await client.query('SELECT sha256 FROM bpbd_source_records WHERE source=$1 AND entity=$2 AND source_id=$3', [source, entity, id]);
    if (old.rowCount && old.rows[0].sha256 !== digest) throw new Error(`Sumber berubah: ${source}/${entity}/${id}. Rekonsiliasi sebelum impor ulang.`);
    await client.query('INSERT INTO bpbd_source_records(source,entity,source_id,data,sha256) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [source, entity, id, json, digest]);
  }
  async function mapped(source: string, entity: string, original: string, moduleCode: string, row: Row) {
    const key = `${source}/${entity}/${original}`;
    if (aliases.has(key)) return aliases.get(key)!;
    let id = original;
    if (records[moduleCode].some(r => r.id === id)) id = `${source}-${entity}-${original}`;
    if (records[moduleCode].some(r => r.id === id)) throw new Error('Benturan ID membutuhkan pemetaan manual.');
    const next = { ...Object.fromEntries(modules.find(m => m.id === moduleCode)!.fields.map(f => [f.key, null])), ...row, id, revision: row.revision || 1, source_system: source, source_entity: entity, source_id: original } as Row;
    await saveRecord(client, moduleCode, next); records[moduleCode].push(next);
    await client.query('INSERT INTO bpbd_source_map(source,entity,source_id,module,record_id) VALUES($1,$2,$3,$4,$5)', [source, entity, original, moduleCode, id]);
    aliases.set(key, id); return id;
  }
  // Explicitly authorized preview data keeps its own provenance. Masters precede links.
  for (const [source, dataset] of [['K3', k3], ['K3-pratinjau', preview]] as const) {
    for (const moduleCode of ['barang', 'kejadian', ...modules.map(m => m.id).filter(id => !['barang','kejadian'].includes(id))]) {
      for (const row of dataset[moduleCode] || []) {
        await archive(source, moduleCode, row.id, row);
        const canonical = { ...row };
        for (const field of modules.find(m => m.id === moduleCode)!.fields.filter(f => ['barang','kejadian'].includes(f.type))) {
          if (row[field.key]) {
            const target = aliases.get(`${source}/${field.type}/${row[field.key]}`);
            if (!target) throw new Error(`Relasi ${source}/${moduleCode}/${row.id}/${field.key} tidak ditemukan.`);
            canonical[field.key] = target;
            await client.query('INSERT INTO bpbd_source_links(source,entity,source_id,field,target_entity,target_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [source,moduleCode,row.id,field.key,field.type,String(row[field.key])]);
          }
        }
        await mapped(source, moduleCode, row.id, moduleCode, canonical);
      }
    }
  }
  if (manifest.preview?.activated) {
    const bytes = await readFile(manifest.preview.file);
    if (hash(bytes) !== manifest.preview.sha256) throw new Error('Pratinjau berubah setelah diekstrak.');
    await client.query('INSERT INTO bpbd_source_files(id,source,owner_role,name,mime,content,sha256) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', ['K3-pratinjau', 'K3-pratinjau', 'SEK', 'BUKA_PRATINJAU.html', 'text/html', bytes, hash(bytes)]);
  }
  for (const [entity, rows] of Object.entries(k1)) for (const row of rows) await archive('K1', entity, sourceId(entity, row), row);
  const lookup = (entity: string, id: unknown) => {
    const mapped = aliases.get(`K1/${entity}/${id}`); if (!mapped) throw new Error(`Relasi K1 tidak ditemukan: ${entity}/${id}`); return mapped;
  };
  for (const row of k1.master_barang || []) {
    const id = sourceId('master_barang', row);
    const canonical = await mapped('K1', 'master_barang', id, 'barang', { ...row, id, nama: row.nama_barang ?? row.nama, satuan: row.satuan, minimum: null, catatan: row.deskripsi });
    const opening = Number(row.stok_awal ?? row.saldo_awal ?? row.stok ?? 0);
    if (opening) {
      const original = `${id}-saldo-awal`;
      const entry = { id: original, barang: canonical, sumber: 'Saldo gabungan K1', jumlah: opening, jenis: 'Saldo awal', tanggal: null, catatan: 'Saldo awal dari master sumber; tanggal belum tersedia.' };
      await archive('K1', 'saldo_awal', original, entry); await mapped('K1', 'saldo_awal', original, 'masuk', entry);
    }
  }
  for (const row of k1.kejadian_bencana || []) {
    const id = sourceId('kejadian_bencana', row), wilayah = (k1.master_wilayah || []).find(w => w.wilayah_id === row.wilayah_id);
    await mapped('K1', 'kejadian_bencana', id, 'kejadian', { ...row, id, nama: row.jenis_bencana || `Kejadian ${id}`, alamat: row.lokasi, kronologi: row.deskripsi, kecamatan: wilayah?.kecamatan, kelurahan: wilayah?.kelurahan_desa });
  }
  for (const row of k1.logistik_transaksi || []) {
    const id = sourceId('logistik_transaksi', row), direction = String(row.jenis ?? row.jenis_transaksi ?? row.tipe_transaksi).toLowerCase();
    if (!['masuk','keluar'].includes(direction)) throw new Error(`Arah transaksi K1 belum dipetakan: ${id}.`);
    await mapped('K1', 'logistik_transaksi', id, direction, { ...row, id, barang: lookup('master_barang', row.barang_id ?? row.id_barang), jumlah: row.jumlah ?? row.kuantitas ?? row.qty,
      sumber: 'Saldo gabungan K1', jenis: direction === 'masuk' ? 'Penerimaan' : row.jenis,
      tujuan: row.tujuan_penggunaan ?? row.penerima, catatan: row.keterangan });
  }
  for (const row of k1.mitigasi_bencana || []) {
    const id = sourceId('mitigasi_bencana', row);
    await mapped('K1', 'mitigasi_bencana', id, 'pencegahan', { ...row, id, nama: row.kegiatan || `Mitigasi ${id}`, penanggung_jawab: row.pelaksana, catatan: row.keterangan, kejadian_id: row.kejadian_id == null ? null : lookup('kejadian_bencana', row.kejadian_id) });
  }
  // Post-disaster assessments do not automatically become BTT applications.
  // Preserve and expose these source records to RR/SEK until their field map is agreed.
  for (const [entity, rows] of Object.entries(k1)) for (const row of rows) {
    for (const [field, target] of [['barang_id','master_barang'],['kejadian_id','kejadian_bencana'],['wilayah_id','master_wilayah']]) {
      if (row[field] == null || entity === target) continue;
      await client.query('INSERT INTO bpbd_source_links(source,entity,source_id,field,target_entity,target_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', ['K1', entity, sourceId(entity,row), field, target, String(row[field])]);
    }
  }
  for (const file of k3.attachments || []) {
    const moduleCode = String(file.module), record = aliases.get(`K3/${file.module}/${file.record}`);
    if (!record) throw new Error(`Relasi lampiran tidak ditemukan: ${file.id}`);
    const bytes = await readFile(join(manifest.root, 'Kelompok_3/data/v2/operasional/attachments', `${file.id}.${file.ext}`));
    await client.query('INSERT INTO bpbd_op_files(id,module,record_id,data,content,sha256) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [file.id, moduleCode, record, JSON.stringify(file), bytes, hash(bytes)]);
  }
  const sourcesDir = join(manifest.root, 'Kelompok_3/src/main/resources/static/sumber');
  const sourceManifest = JSON.parse(await readFile(join(sourcesDir, 'manifest.json'), 'utf8')) as { files: { name: string; url: string }[] };
  const owners: Record<string, string> = { 'dokumen-5.xlsx': 'PK', 'dokumen-6.xlsx': 'SEK', 'dokumen-7.xlsx': 'KL', 'dokumen-8.pdf': 'RR', 'dokumen-9.xlsx': 'RR' };
  for (const name of await readdir(sourcesDir)) {
    const bytes = await readFile(join(sourcesDir, name));
    const display = sourceManifest.files.find(f => basename(f.url) === name)?.name || name;
    await client.query('INSERT INTO bpbd_source_files(id,source,owner_role,name,mime,content,sha256) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', [`K3-${name}`, 'K3', owners[name] || 'SEK', display, name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json', bytes, hash(bytes)]);
  }
  await client.query(`UPDATE bpbd_op_records SET data=jsonb_set(data,'{tracking_expired}',to_jsonb(CASE WHEN data->>'tracking_expired'='true' THEN 'Ya' ELSE 'Tidak' END)) WHERE module='barang' AND jsonb_typeof(data->'tracking_expired')='boolean'`);
  checkStock(records);
  const counts = Object.fromEntries(Object.entries(records).map(([key, rows]) => [key, rows.length]));
  const report = { at: new Date().toISOString(), counts, sourceRows: (await client.query('SELECT source,entity,count(*)::int AS count FROM bpbd_source_records GROUP BY source,entity ORDER BY source,entity')).rows,
    links: (await client.query('SELECT count(*)::int AS n FROM bpbd_source_links')).rows[0].n,
    attachments: (await client.query('SELECT count(*)::int AS n FROM bpbd_op_files')).rows[0].n,
    sourceFiles: (await client.query('SELECT count(*)::int AS n FROM bpbd_source_files')).rows[0].n,
    stock: stockOf(records).map(s => ({ barang: s.barang, satuan: s.satuan, sumber: s.sumber, saldo: s.saldo })),
    previewConflicts: manifest.preview?.conflicts || [],
    notes: ['K1 donor names remain intact; opening/transactions use one explicitly labelled consolidated source because K1 outgoing records do not identify a funding source.', 'K1 requests remain archived for Admin; their user_id is not assumed to identify an existing K2 researcher.', manifest.preview?.activated ? 'K3 preview activated by user instruction; original snapshot and source conflict notes preserved. Historical logistics do not change stock.' : 'K3 preview has not been activated.'] };
  await client.query('COMMIT'); await writeFile('backups/migration-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await getPool().end(); }
