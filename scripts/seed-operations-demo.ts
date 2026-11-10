import { getPool } from '../db/index.ts';
import { readRecords, saveRecord } from '../lib/operations/repository.ts';
import { validate, checkStock, stockOf } from '../lib/operations/domain.ts';

// Synthetic examples, never a reconstruction of the missing source export.
const note = 'DEMO / SIMULASI. Acuan saldo: docs/INTEGRASI-KELOMPOK.md (K1: 240 pcs, 38 dus, 71 paket). Nama, tanggal, transaksi, dan kegiatan adalah contoh, bukan riwayat asli.';
const pool = getPool();
const client = await pool.connect();
let added = 0;
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-operasional'))");
  const records = await readRecords(client);
  if (Object.values(records).flat().some(r => r.demo_dataset !== 'operations-v1')) {
    throw new Error('Seed demo hanya untuk database operasional kosong atau berisi dataset demo ini. Data lain dipertahankan.');
  }
  async function add(module: string, id: string, data: Record<string, unknown>) {
    if (records[module].some(r => r.id === id)) return;
    const row = { ...validate(module, { ...data, id, catatan: note, sumber_data: note }, records), revision: 1, demo_dataset: 'operations-v1', created_at: new Date().toISOString() };
    await saveRecord(client, module, row);
    records[module].push(row); added++;
  }
  for (const [index, name, unit, balance, minimum, category] of [
    [1, 'DEMO - Selimut', 'pcs', 240, 100, 'Sandang'],
    [2, 'DEMO - Air mineral', 'dus', 38, 50, 'Pangan'],
    [3, 'DEMO - Paket kebutuhan pokok', 'paket', 71, 30, 'Pangan'],
  ] as const) {
    const barang = `DEMO-BARANG-${index}`;
    await add('barang', barang, { nama: name, satuan: unit, minimum, kategori: category, tracking_expired: 'Tidak' });
    for (const [month, incoming, outgoing] of [['08', balance, 10], ['09', 20, 10], ['10', 30, 20]] as const) {
      const base = { barang, sumber: 'Saldo gabungan K1', kondisi: 'Baik' };
      await add('masuk', `DEMO-IN-${index}-${month}`, { ...base, tanggal: `2026-${month}-05`, jumlah: incoming, jenis: 'Penerimaan', sumber_barang: 'Donatur simulasi' });
      await add('keluar', `DEMO-OUT-${index}-${month}`, { ...base, tanggal: `2026-${month}-15`, jumlah: outgoing, tujuan: 'Posko simulasi', kecamatan: 'Wilayah demo' });
    }
    await add('opname', `DEMO-OPNAME-${index}`, { barang, sumber: 'Saldo gabungan K1', tanggal: '2026-11-01', fisik: balance });
  }
  await add('dokumen', 'DEMO-SEK-1', { nama: 'DEMO - Laporan kesiapan logistik', tahun: 2026, keluaran: 'Laporan', tanggal: '2026-10-20', status: 'Selesai' });
  await add('pencegahan', 'DEMO-PK-1', { nama: 'DEMO - Simulasi kesiapsiagaan', tahun: 2026, jenis: 'Simulasi', tanggal: '2026-10-10', status: 'Selesai', target_peserta: 50, realisasi_peserta: 45 });
  await add('kejadian', 'DEMO-KL-1', { nama: 'DEMO - Penanganan banjir', jenis_bencana: 'Banjir', tanggal: '2026-10-15', kecamatan: 'Wilayah demo', kk: 20, jiwa: 60 });
  await add('btt', 'DEMO-RR-1', { nama: 'DEMO - Asesmen pemulihan', tanggal: '2026-10-16', asesmen_selesai: 'Ya', tanggal_selesai: '2026-10-17', bendahara: 'Belum', transfer: 'Belum' });
  await add('alokasi', 'DEMO-ALOKASI-1', { tahun: 2026, sumber: 'APBD', versi: 'Murni', tanggal: '2026-08-01', tangki: 10, kapasitas: 5000 });
  await add('air', 'DEMO-AIR-1', { tanggal: '2026-09-15', kecamatan: 'Wilayah demo', tangki: 2, liter: 10000, sumber: 'APBD' });
  await add('bantuan', 'DEMO-BANTUAN-1', { tanggal: '2026-10-15', nama: 'DEMO - Bantuan pemulihan', penerima: 'Penerima simulasi', jumlah: 5, satuan: 'paket', sumber: 'APBD' });
  // Opname snapshots do not affect the stock ledger.
  for (const row of records.opname) {
    if (row.demo_dataset !== 'operations-v1' || row.buku != null) continue;
    row.buku = stockOf(records).find(s => s.barang === row.barang && s.sumber === row.sumber)?.saldo ?? 0;
    row.selisih = Number(row.fisik) - Number(row.buku);
    await saveRecord(client, 'opname', row);
  }
  checkStock(records);
  await client.query('COMMIT');
  console.log(JSON.stringify({ added, total: Object.values(records).flat().length, stock: stockOf(records) }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  console.error((error as Error).message); process.exitCode = 1;
} finally { client.release(); await pool.end(); }
