"use client";
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from './context';
import { Action, Notice, PageHead } from './shared';
import { toast } from 'sonner';

type Row = Record<string, unknown> & { id: string };
type Stock = { barang: string; nama: string; satuan: string; sumber: string; masuk: number; keluar: number; saldo: number; peringatan: boolean };
type Snapshot = { role: string; writable: boolean; stock: Stock[]; records: Record<string, Row[]>; archive: { entity: string; source_id: string; data: Record<string, unknown> }[] };
const fmt = (v: unknown) => v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const numeric = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const sources = ['APBD','APBN','BTT','DSP','CSR','Donatur','Lainnya','Saldo gabungan K1'];
const tones = ['#0f766e','#1d4ed8','#ea580c','#7c3aed','#0891b2','#a16207'];
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/operasional/' + path, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BPBD-Request': '1' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(data.error || 'Permintaan gagal.'); return data;
}
export function OperationalWorkspace() {
  return <><PageHead title="Operasional Bidang" subtitle="Pencatatan, impor, revisi, dokumentasi, dan analisis kegiatan bidang."/>
    <iframe title="Ruang kerja operasional BPBD" src="/api/operasional/assets/index.html?embed=1" style={{ width: '100%', minHeight: 360, height: 'calc(100dvh - 210px)', border: '1px solid #dce3ea', borderRadius: 12, background: '#fff' }}/></>;
}
export function ResearchAdminDashboard() {
  const { store, navigate } = useApp();
  const [legacy, setLegacy] = useState<{ source_id: string; data: Record<string, unknown> }[]>([]);
  const [legacyError, setLegacyError] = useState('');
  useEffect(() => { let active = true; void request<typeof legacy>('legacy-research').then(rows => { if (active) setLegacy(rows); }).catch(e => { if (active) setLegacyError(e.message); }); return () => { active = false; }; }, []);
  const stats = [['Pendaftaran menunggu', store.users.filter(u => u.role === 'PEN' && u.status === 'Menunggu Persetujuan').length], ['Permohonan diajukan', store.research.filter(r => r.status === 'Diajukan').length], ['Hasil perlu diperiksa', store.research.filter(r => r.versions.length && !r.complete).length], ['Perpanjangan diajukan', store.research.filter(r => r.extension).length]];
  return <><PageHead title="Dashboard Penelitian" subtitle="Pemeriksaan akun, permohonan, izin akses, dan hasil penelitian oleh Admin."/>
    <div className="stats-grid">{stats.map(([label, count]) => <section className="panel panel-pad" key={label}><p>{label}</p><strong style={{ fontSize: 28 }}>{count}</strong></section>)}</div>
    <section className="panel panel-pad" style={{ marginTop: 20 }}><h2>Tindak lanjut penelitian</h2><div className="page-actions" style={{ marginTop: 16 }}><Action onClick={() => navigate('/admin/pendaftaran')}>Verifikasi Akun</Action><Action onClick={() => navigate('/riset/permohonan')}>Periksa Permohonan</Action><Action onClick={() => navigate('/riset/hasil')}>Tinjau Hasil</Action><Action onClick={() => navigate('/admin/akses-riset')}>Kelola Izin Data</Action></div></section>
    <section className="panel panel-pad" style={{ marginTop: 20 }}><h2>Arsip permintaan data sebelumnya</h2><p>Identitas pemohon pada arsip perlu dicocokkan dengan akun penelitian sebelum menjadi permohonan aktif. Izin akses tidak diberikan otomatis.</p>{legacyError && <Notice kind="danger">{legacyError}</Notice>}{legacy.map(r => <details key={r.source_id} style={{ padding: 12 }}><summary>Permintaan {r.source_id}</summary><RecordDetails row={r.data}/></details>)}{!legacy.length && !legacyError && <p>Belum ada arsip permintaan.</p>}</section></>;
}
export function LogisticsDashboard() {
  const { navigate } = useApp();
  const [data, setData] = useState<Snapshot>(); const [error, setError] = useState(''); const [search, setSearch] = useState('');
  const [tab, setTab] = useState('stock'); const [formOpen, setFormOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState('masuk'); const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }));
  const [source, setSource] = useState('APBD'); const [destination, setDestination] = useState(''); const [note, setNote] = useState('');
  const [donor, setDonor] = useState(''); const [recipient, setRecipient] = useState(''); const [district, setDistrict] = useState(''); const [condition, setCondition] = useState('Baik');
  const [sourceFiles, setSourceFiles] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { let active = true; void request<typeof sourceFiles>('source-files').then(files => { if (active) setSourceFiles(files); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  const [items, setItems] = useState([{ barang: '', jumlah: 1 }]);
  async function load() { try { setData(await request<Snapshot>('dashboard')); setError(''); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { let active = true; void request<Snapshot>('dashboard').then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function save() {
    setBusy(true);
    try { await request('transactions', { module: direction, rows: items.map(item => ({ ...item, tanggal: date, sumber: source, jenis: 'Penerimaan', tujuan: destination, tujuan_penggunaan: destination, sumber_barang: donor, penerima: recipient, kecamatan: district, kondisi: condition, catatan: note })) });
      toast.success('Semua rincian transaksi tersimpan.'); setFormOpen(false); setItems([{ barang: '', jumlah: 1 }]); await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  if (!data) return <><PageHead title="Dashboard Logistik" subtitle="Ikhtisar persediaan dan pergerakan bantuan."/>{error ? <Notice kind="danger">{error}<Action secondary onClick={load}>Coba lagi</Action></Notice> : <p>Memuat data…</p>}</>;
  const records = data.records, barang = records.barang || [];
  const transactions = ['masuk', 'keluar'].flatMap(module => (records[module] || []).map(r => ({ ...r, arah: module } as Row & { arah: string }))).sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const months = new Map<string, { bulan: string; masuk: number; keluar: number }>();
  transactions.forEach(r => { if (r.tanggal) { const month = String(r.tanggal).slice(0, 7); const item = months.get(month) || { bulan: month, masuk: 0, keluar: 0 }; item[r.arah as 'masuk' | 'keluar']++; months.set(month, item); } });
  const category = new Map<string, number>(); barang.forEach(r => { const key = String(r.kategori || 'Belum dikategorikan'); category.set(key, (category.get(key) || 0) + 1); });
  const totals = new Map<string, number>(); data.stock.forEach(s => totals.set(s.satuan, (totals.get(s.satuan) || 0) + s.saldo));
  const matches = (r: unknown) => JSON.stringify(r).toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id'));
  return <><PageHead title="Dashboard Logistik" subtitle="Ikhtisar persediaan, transaksi bantuan, dan data bidang." actions={<div className="page-actions"><Action secondary onClick={load}>Muat ulang</Action>{data.writable && <Action onClick={() => setFormOpen(!formOpen)}>Transaksi Baru</Action>}</div>}/>
    {error && <Notice kind="danger">{error}</Notice>}
    <div className="stats-grid">{[['Jenis barang', barang.length], ['Transaksi masuk', records.masuk?.length || 0], ['Transaksi keluar', records.keluar?.length || 0], ['Stok di bawah minimum', data.stock.filter(s => s.peringatan).length]].map(([label, n]) => <section className="panel panel-pad" key={label}><p>{label}</p><strong style={{ fontSize: 28 }}>{n}</strong></section>)}</div>
    <section className="panel panel-pad" style={{ margin: '18px 0' }}><h2>Posisi persediaan</h2><p style={{ marginTop: 8 }}>{totals.size ? [...totals].map(([unit, n]) => `${numeric(n)} ${unit}`).join(' · ') : 'Belum ada mutasi persediaan.'}</p><p className="small muted">Jumlah dengan satuan berbeda ditampilkan terpisah. Riwayat lama tidak menambah stok aktif.</p></section>
    {formOpen && data.writable && <section className="panel panel-pad" style={{ marginBottom: 20 }}><h2>Transaksi logistik</h2><form onSubmit={e => { e.preventDefault(); void save(); }}><div className="form-grid" style={{ marginTop: 14 }}>
      <label className="field">Arah transaksi<select value={direction} onChange={e => setDirection(e.target.value)}><option value="masuk">Masuk</option><option value="keluar">Keluar</option></select></label>
      <label className="field">Tanggal<input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
      <label className="field">Sumber<select value={source} onChange={e => setSource(e.target.value)}>{sources.map(s => <option key={s}>{s}</option>)}</select></label>
      {direction === 'keluar' && <label className="field">Tujuan / penerima<input required value={destination} onChange={e => setDestination(e.target.value)}/></label>}
      {direction === 'masuk' && <label className="field">Asal bantuan / donor<input required value={donor} onChange={e => setDonor(e.target.value)} placeholder="BPBD Provinsi, PMI, perusahaan, atau donatur"/></label>}
      {direction === 'keluar' && <><label className="field">Kecamatan tujuan<input required value={district} onChange={e => setDistrict(e.target.value)}/></label><label className="field">Nama penerima<input value={recipient} onChange={e => setRecipient(e.target.value)}/></label></>}
      <label className="field">Kondisi barang<input value={condition} onChange={e => setCondition(e.target.value)}/></label>
      <label className="field span-2">Keterangan<textarea value={note} onChange={e => setNote(e.target.value)}/></label>
    </div>{items.map((item, i) => <div className="form-grid" style={{ marginTop: 10 }} key={i}>
      <label className="field">Barang {i + 1}<select required value={item.barang} onChange={e => setItems(old => old.map((v, n) => n === i ? { ...v, barang: e.target.value } : v))}><option value="">Pilih barang</option>{barang.map(b => <option key={b.id} value={b.id}>{fmt(b.nama)} ({fmt(b.satuan)})</option>)}</select></label>
      <label className="field">Jumlah<input type="number" min="1" step="1" required value={item.jumlah} onChange={e => setItems(old => old.map((v, n) => n === i ? { ...v, jumlah: Number(e.target.value) } : v))}/></label>
    </div>)}<div className="page-actions" style={{ marginTop: 14 }}><Action secondary type="button" onClick={() => setItems(old => [...old, { barang: '', jumlah: 1 }])}>Tambah Barang</Action><Action type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan Transaksi'}</Action><Action secondary type="button" onClick={() => setFormOpen(false)}>Batal</Action></div></form></section>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
      <section className="panel panel-pad"><h2>Tren jumlah transaksi</h2><div style={{ height: 240 }}><ResponsiveContainer minWidth={0} initialDimension={{width:300,height:240}}><LineChart data={[...months.values()].sort((a, b) => a.bulan.localeCompare(b.bulan)).slice(-12)}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="bulan"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="masuk" name="Masuk" stroke={tones[0]}/><Line type="monotone" dataKey="keluar" name="Keluar" stroke={tones[2]}/></LineChart></ResponsiveContainer></div></section>
      <section className="panel panel-pad"><h2>Stok per barang dan sumber</h2><div style={{ height: 240 }}><ResponsiveContainer minWidth={0} initialDimension={{width:300,height:240}}><BarChart data={data.stock.slice(0, 10).map(s => ({ ...s, label: `${s.nama} (${s.satuan}) · ${s.sumber}` }))}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label" hide/><YAxis/><Tooltip labelFormatter={v => v}/><Bar dataKey="saldo" name="Saldo" fill={tones[1]}/></BarChart></ResponsiveContainer></div></section>
      <section className="panel panel-pad"><h2>Komposisi kategori barang</h2><div style={{ height: 240 }}><ResponsiveContainer minWidth={0} initialDimension={{width:300,height:240}}><PieChart><Pie data={[...category].map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius={75}>{[...category].map(([k], i) => <Cell key={k} fill={tones[i % tones.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></section>
    </div>
    <section className="panel panel-pad" style={{ marginTop: 20 }}><div className="page-actions"><Action secondary onClick={() => setTab('stock')}>Persediaan</Action><Action secondary onClick={() => setTab('transactions')}>Semua Transaksi</Action><Action secondary onClick={() => setTab('source')}>Data Asal</Action><Action secondary onClick={() => navigate('/operasional')}>Pencatatan & Ekspor</Action></div>
      <label className="field" style={{ margin: '16px 0' }}>Cari catatan<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama, ID, sumber, atau wilayah"/></label>
      {tab === 'stock' ? <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr>{['Barang','Kategori','Satuan','Sumber','Masuk','Keluar','Saldo','Kedaluwarsa'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.stock.filter(matches).map(s => <tr key={s.barang + s.sumber}><td>{s.nama}</td><td>{fmt(barang.find(b => b.id === s.barang)?.kategori)}</td><td>{s.satuan}</td><td>{s.sumber}</td><td>{numeric(s.masuk)}</td><td>{numeric(s.keluar)}</td><td>{numeric(s.saldo)}{s.peringatan ? ' ⚠' : ''}</td><td>{[true,'Ya'].includes(barang.find(b => b.id === s.barang)?.tracking_expired as boolean | string) ? 'Dipantau' : '—'}</td></tr>)}</tbody></table>{!data.stock.length && <p>Belum ada persediaan tercatat.</p>}</div>
        : tab === 'transactions' ? <>{transactions.filter(matches).map(r => <details key={r.arah + r.id} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}><summary>{fmt(r.tanggal)} · {r.arah === 'masuk' ? 'Masuk' : 'Keluar'} · {fmt(barang.find(b => b.id === r.barang)?.nama || r.barang)} · {fmt(r.jumlah)}</summary><RecordDetails row={r}/></details>)}{!transactions.length && <p>Belum ada transaksi.</p>}</>
        : <>{data.archive.filter(matches).map(r => <details key={r.entity + r.source_id} style={{ padding: '12px 0' }}><summary>{r.entity.replaceAll('_',' ')} · {r.source_id}</summary><RecordDetails row={r.data}/></details>)}{!data.archive.length && <p>Belum ada data asal yang tersedia untuk bidang Anda.</p>}</>}
    </section><section className="panel panel-pad" style={{ marginTop: 20 }}><h2>Dokumen sumber bidang</h2><p>Arsip sumber tersedia sesuai bidang. Dokumen arsip tidak otomatis menjadi catatan operasional aktif.</p>{sourceFiles.map(file => <p key={file.id} style={{ marginTop: 10 }}><a className="text-button" href={'/api/operasional/source-files/' + encodeURIComponent(file.id)} download>{file.name}</a></p>)}{!sourceFiles.length && <p>Belum ada dokumen sumber untuk bidang Anda.</p>}</section></>;
}
function RecordDetails({ row }: { row: Record<string, unknown> }) {
  return <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 3fr', gap: 8, padding: '16px 0', overflowWrap: 'anywhere' }}>{Object.entries(row).filter(([k]) => k !== 'history').map(([key, v]) => <div key={key} style={{ display: 'contents' }}><dt style={{ fontWeight: 600 }}>{key.replaceAll('_',' ')}</dt><dd>{fmt(v)}</dd></div>)}</dl>;
}
