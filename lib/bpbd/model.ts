export type Role = 'ADM' | 'PK' | 'KL' | 'RR' | 'SEK' | 'PEN';
export const roles: Record<Role, { name: string; short: string; slug: string; person: string }> = {
  ADM: { name: 'Admin Sistem BPBD', short: 'Admin Sistem', slug: '', person: 'Admin Demo' },
  PK: { name: 'Bidang Pencegahan dan Kesiapsiagaan', short: 'Bidang Pencegahan dan Kesiapsiagaan', slug: 'pencegahan', person: 'Petugas Pencegahan Demo' },
  KL: { name: 'Kedaruratan dan Logistik', short: 'Kedaruratan', slug: 'kedaruratan', person: 'Petugas Kedaruratan Demo' },
  RR: { name: 'Rehabilitasi dan Rekonstruksi', short: 'Rehabilitasi', slug: 'rehabilitasi', person: 'Petugas Rehabilitasi Demo' },
  SEK: { name: 'Sekretariat BPBD', short: 'Sekretariat', slug: 'sekretariat', person: 'Petugas Sekretariat Demo' },
  PEN: { name: 'Peneliti / Akademisi', short: 'Peneliti', slug: 'peneliti', person: 'Nadia Pramesti (Demo)' },
};
export const areas = ['Semarang Utara', 'Semarang Barat', 'Semarang Timur', 'Semarang Tengah', 'Semarang Selatan', 'Genuk', 'Tugu', 'Ngaliyan', 'Mijen', 'Gunungpati', 'Banyumanik', 'Tembalang', 'Pedurungan', 'Gayamsari', 'Gajahmungkur', 'Candisari'];
export const hazards = ['Banjir', 'Tanah longsor', 'Cuaca ekstrem', 'Kebakaran', 'Kekeringan'];
export const operationalStatuses = ['Draf', 'Menunggu Persetujuan', 'Perlu Perbaikan', 'Disetujui', 'Ditolak'];
export const groups: Record<string, { name: string; role: Role; unit: string; metric: string; examples: string[] }> = {
  kejadian: { name: 'Kejadian Bencana', role: 'KL', unit: 'KK', metric: 'Keluarga terdampak', examples: ['Banjir permukiman', 'Longsor talud', 'Pohon tumbang', 'Kebakaran lahan', 'Kekurangan air bersih'] },
  korban: { name: 'Korban dan Pengungsi', role: 'KL', unit: 'orang', metric: 'Pengungsi', examples: ['Pendataan pengungsi', 'Pendataan dampak kejadian'] },
  kebutuhan: { name: 'Kebutuhan Darurat', role: 'KL', unit: 'paket', metric: 'Jumlah kebutuhan', examples: ['Kebutuhan paket kebersihan', 'Kebutuhan makanan siap saji'] },
  logistik: { name: 'Stok dan Transaksi Logistik', role: 'KL', unit: 'paket', metric: 'Stok tersedia', examples: ['Paket sembako', 'Paket kebersihan', 'Paket makanan siap saji'] },
  distribusi: { name: 'Distribusi Bantuan', role: 'KL', unit: 'paket', metric: 'Bantuan disalurkan', examples: ['Distribusi sembako', 'Distribusi perlengkapan darurat'] },
  risiko: { name: 'Risiko dan Wilayah Rawan', role: 'PK', unit: 'lokasi', metric: 'Lokasi teridentifikasi', examples: ['Pemetaan wilayah rawan banjir', 'Pemetaan lereng rawan longsor'] },
  mitigasi: { name: 'Mitigasi Bencana', role: 'PK', unit: 'kegiatan', metric: 'Jumlah kegiatan', examples: ['Pembersihan saluran lingkungan', 'Pemasangan rambu evakuasi'] },
  edukasi: { name: 'Edukasi dan Simulasi', role: 'PK', unit: 'peserta', metric: 'Peserta kegiatan', examples: ['Simulasi evakuasi sekolah', 'Pelatihan relawan siaga'] },
  kajian: { name: 'Kajian Risiko', role: 'PK', unit: 'dokumen', metric: 'Dokumen kajian', examples: ['Kajian risiko wilayah', 'Pembaruan rencana kontingensi'] },
  kerusakan: { name: 'Kerusakan Pascabencana', role: 'RR', unit: 'unit', metric: 'Bangunan terdampak', examples: ['Pendataan kerusakan rumah', 'Pendataan fasilitas umum'] },
  pemulihan: { name: 'Kegiatan Pemulihan', role: 'RR', unit: 'kegiatan', metric: 'Jumlah kegiatan', examples: ['Pemulihan akses jalan', 'Perbaikan drainase lingkungan'] },
  progres: { name: 'Progres Rehabilitasi', role: 'RR', unit: '%', metric: 'Progres kegiatan', examples: ['Rehabilitasi talud', 'Rekonstruksi jembatan lingkungan'] },
  dokumentasi: { name: 'Dokumentasi Pascabencana', role: 'RR', unit: 'dokumen', metric: 'Dokumen tersedia', examples: ['Dokumentasi penanganan', 'Dokumentasi pemulihan'] },
  administrasi: { name: 'Administrasi Pendukung', role: 'SEK', unit: 'dokumen', metric: 'Dokumen administrasi', examples: ['Notula koordinasi bidang', 'Surat tugas penanganan'] },
  arsip: { name: 'Dokumentasi Sekretariat', role: 'SEK', unit: 'dokumen', metric: 'Dokumen tersedia', examples: ['Dokumentasi rapat koordinasi', 'Arsip kegiatan lintas bidang'] },
};
export type Entry = { id: string; group: string; title: string; area: string; hazard: string; date: string; status: string; handling: string; amount: number; unit: string; description: string; version: number; history: Event[]; archived?: boolean; linkedId?: string; fileId?: string; fileName?: string };
export type Event = { at: string; actor: string; action: string; note?: string };
export type Audit = Event & { id: string; object: string; role: Role; before?: string; after?: string };
export type Research = { id: string; owner: string; title: string; institution: string; purpose: string; requestedGroups: string[]; area: string; start: string; end: string; deadline: string; status: string; access: string; accessEnd: string; download: boolean; decisions: Record<string, { status: string; note: string; groups: string[]; download?: boolean; accessEnd?: string }>; history: Event[]; versions: ResultVersion[]; extension?: { date: string; reason: string }; supportingId?: string; supportingName?: string; complete?: boolean };
export type ResultVersion = { id: string; at: string; filename: string; fileId: string; summary: string; feedback: string; review: string; note: string };
export type User = { id: string; name: string; email: string; role: Role; institution: string; status: string; note: string; demoPassword: string };
export type Filters = { from: string; to: string; area: string; hazard: string; search: string; status: string };
export const defaultFilters: Filters = { from: '2026-01-01', to: '2026-10-08', area: 'all', hazard: 'all', search: '', status: 'all' };
export type Report = { id: string; title: string; group: string; filters: Filters; rows: Entry[]; created: string; actor: string; templateVersion: number; sections: string[]; role: Role };
export type ImportJob = { id: string; group: string; filename: string; count: number; at: string; actor: string; status: string; ids: string[]; fingerprint: string };
export type Store = { schema: 1; researcherId: string; entries: Entry[]; research: Research[]; users: User[]; reports: Report[]; imports: ImportJob[]; audit: Audit[]; masters: Record<string, string[]>; settings: { maxUploadMb: number; reminderDays: number; approval: boolean }; template: { version: number; sections: string[]; history: Event[] }; reviewer: Partial<Record<Role, boolean>>; adminOperational: boolean; profile: Record<string, string> };
export const DEMO_USER = 'PEN-001';
// Public credentials for this browser-only prototype; never use real passwords here.
export const DEMO_PASSWORD = 'BPBDdemo2026!';
export function migrateDemoStore(store: Store): Store {
  return { ...store, users: store.users.map(user => ({ ...user, demoPassword: user.demoPassword ?? DEMO_PASSWORD })) };
}
export function sessionUser(store: Store, id: string | null) {
  return store.users.find(user => user.id === id && (user.status === 'Aktif' || user.role === 'PEN' && ['Menunggu Persetujuan', 'Perlu Perbaikan', 'Ditolak'].includes(user.status)));
}
export function authenticateDemo(store: Store, email: string, password: string) {
  const account = store.users.find(user => user.email.trim().toLowerCase() === email.trim().toLowerCase() && user.demoPassword === password);
  return account ? sessionUser(store, account.id) : undefined;
}
export const canReviewOperational = (role: Role) => role === 'ADM';
export const referenceDate = '2026-10-08';
export const timestamp = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;
export function formatDate(value: string, time = false) { if (!value) return '—'; const d = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value); if (Number.isNaN(d.getTime())) return '—'; return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Jakarta' }).format(d) + (time ? ' WIB' : ''); }
export const number = (n: number) => new Intl.NumberFormat('id-ID').format(n);
export function home(role: Role) { return role === 'PEN' ? '/peneliti' : role === 'ADM' ? '/dashboard' : `/dashboard/${roles[role].slug}`; }
export function canRead(role: Role, group: string) { return !!groups[group] && role !== 'PEN' && (role === 'ADM' || groups[group].role === role); }
export function canEdit(store: Store, role: Role, group: string) { return !!groups[group] && (role === 'ADM' ? store.adminOperational : groups[group].role === role); }
export function isReviewer(store: Store, role: Role) { return ['PK', 'KL', 'RR'].includes(role) && !!store.reviewer[role]; }
export function canVisit(store: Store, role: Role, path: string, accountId?: string) {
  const p = path.split('?')[0];
  if (['/', '/masuk', '/daftar-peneliti', '/pemulihan-akun', '/profil', '/bantuan', '/403', '/404', '/gangguan'].includes(p)) return true;
  if (role === 'PEN') {
    const account = sessionUser(store, accountId || null);
    if (p === '/status-akun') return true;
    if (account?.status !== 'Aktif') return false;
    if (!p.startsWith('/peneliti')) return false;
    const id = p.split('/').filter(Boolean).at(-1);
    if (id && /^(RSET|RES)-/.test(id)) return store.research.some(r => r.id === id && r.owner === accountId);
    return true;
  }
  if (p.startsWith('/peneliti') || p === '/status-akun') return false;
  if (p.startsWith('/admin') || p === '/audit') return role === 'ADM';
  if (p.startsWith('/persetujuan')) {
    if (!canReviewOperational(role)) return false;
    const id = p.split('/')[2];
    return !id || store.entries.some(e => e.id === id && !e.archived);
  }
  if (p.startsWith('/riset')) {
    if (!(role === 'SEK' || isReviewer(store, role))) return false;
    const id = p.split('/')[3];
    return !id || store.research.some(r => r.id === id && (role === 'SEK' || r.requestedGroups.some(g => groups[g]?.role === role)));
  }
  if (p === '/laporan/template') return role === 'SEK';
  if (p.startsWith('/data/')) { const [, , group, id, edit] = p.split('/'); return canRead(role, group) && (!(id === 'baru' || edit === 'edit') || canEdit(store, role, group)); }
  if (p.startsWith('/impor/')) { const group = p.split('/')[2]; if (group === 'pekerjaan') { const job = store.imports.find(j => j.id === p.split('/')[3]); return !!job && canRead(role, job.group); } return canEdit(store, role, group); }
  if (p === '/impor') return role !== 'ADM' || store.adminOperational;
  if (p.startsWith('/dashboard')) return role === 'ADM' || p === home(role);
  return true;
}
export function filterEntries(entries: Entry[], f: Filters) { return entries.filter(e => !e.archived && (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) && (f.area === 'all' || e.area === f.area) && (f.hazard === 'all' || e.hazard === f.hazard) && (f.status === 'all' || e.status === f.status) && (!f.search || `${e.title} ${e.id} ${e.area}`.toLocaleLowerCase('id').includes(f.search.toLocaleLowerCase('id')))); }
export function approvedGroups(r: Research) { return [...new Set(Object.values(r.decisions).filter(d => d.status === 'Disetujui').flatMap(d => d.groups))]; }
export function accessActive(r: Research) { return r.access === 'Aktif' && r.accessEnd >= referenceDate; }
export function authorizedResearchEntries(store: Store, request: Research, owner: string) { if (request.owner !== owner || sessionUser(store, owner)?.status !== 'Aktif' || !accessActive(request)) return []; return store.entries.filter(e => !e.archived && e.status === 'Disetujui' && approvedGroups(request).includes(e.group) && (request.area === 'all' || request.area === e.area) && e.date >= request.start && e.date <= request.end); }
export function validateEntry(e: Partial<Entry>): Record<string, string> { const errors: Record<string, string> = {}; if (!e.title?.trim()) errors.title = 'Nama catatan wajib diisi.'; if (!e.area || !areas.includes(e.area)) errors.area = 'Pilih kecamatan yang tersedia.'; if (!e.hazard || !hazards.includes(e.hazard)) errors.hazard = 'Pilih jenis bencana.'; if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date)) || new Date(e.date).toISOString().slice(0, 10) !== e.date) errors.date = 'Masukkan tanggal yang valid.'; if (!Number.isFinite(e.amount) || Number(e.amount) < 0 || (e.unit === '%' && Number(e.amount) > 100)) errors.amount = e.unit === '%' ? 'Progres harus antara 0 dan 100.' : 'Jumlah harus berupa angka nol atau lebih.'; return errors; }
export function seedStore(): Store {
  const entries: Entry[] = [];
  Object.entries(groups).forEach(([group, config], gi) => {
    const count = group === 'kejadian' ? 48 : group === 'logistik' ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const hi = group === 'kejadian' ? (i % 10 < 5 ? 0 : i % 10 < 7 ? 1 : i % 10 < 9 ? 2 : 3) : i % 5;
      const month = group === 'kejadian' ? [3, 7, 13, 20, 24, 27, 31, 37, 44, 48].findIndex(boundary => i < boundary) + 1 : 7 + i % 4;
      const day = month === 10 ? 1 + i % 7 : 3 + i % 24;
      const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const area = areas[(i * 3 + gi) % areas.length];
      const status = i === count - 1 ? 'Menunggu Persetujuan' : i === count - 2 && group !== 'kejadian' ? 'Draf' : 'Disetujui';
      entries.push({ id: `${group === 'kejadian' ? 'KJD' : group.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`, group, title: `${config.examples[(group === 'kejadian' ? hi : i) % config.examples.length]}${group === 'logistik' ? '' : ` di ${area}`}`, area, hazard: hazards[hi], date, status, handling: i % 4 === 0 ? 'Dalam penanganan' : 'Selesai', amount: group === 'kejadian' ? 4 + i * 3 % 75 : group === 'logistik' ? 25 + i * 17 : group === 'progres' ? 20 + i * 15 : group === 'edukasi' ? 30 + i * 10 : 1 + i % 4, unit: config.unit, description: 'Catatan sintetis untuk meninjau alur sistem. Informasi ini bukan laporan kejadian atau data resmi BPBD Kota Semarang.', version: 1, history: [{ at: `${date}T08:30:00+07:00`, actor: roles[config.role].person, action: status === 'Disetujui' ? 'Data disetujui' : 'Data dibuat', note: 'Data contoh prototipe.' }], ...(config.role === 'RR' ? { linkedId: 'KJD-041' } : {}) });
    }
  });
  const event: Event = { at: '2026-10-07T10:15:00+07:00', actor: 'Sekretariat Demo', action: 'Kelengkapan permohonan diperiksa' };
  const research: Research[] = [
    { id: 'RSET-001', owner: DEMO_USER, title: 'Kajian kerentanan banjir di Kecamatan Genuk', institution: 'Universitas Contoh Semarang', purpose: 'Mengkaji pola kejadian banjir dan kesiapsiagaan masyarakat menggunakan data agregat tanpa identitas pribadi.', requestedGroups: ['kejadian', 'mitigasi'], area: 'Genuk', start: '2026-01-01', end: '2026-10-08', deadline: '2026-11-30', status: 'Disetujui Sebagian', access: 'Aktif', accessEnd: '2026-10-31', download: true, decisions: { KL: { status: 'Disetujui', note: 'Data agregat kejadian sesuai wilayah dan periode.', groups: ['kejadian'], download: true, accessEnd: '2026-10-31' }, PK: { status: 'Ditolak', note: 'Data mitigasi yang diminta belum disahkan.', groups: [] } }, history: [event], versions: [] },
    { id: 'RSET-002', owner: DEMO_USER, title: 'Evaluasi edukasi kesiapsiagaan masyarakat', institution: 'Universitas Contoh Semarang', purpose: 'Mengevaluasi cakupan kegiatan edukasi kesiapsiagaan.', requestedGroups: ['edukasi'], area: 'all', start: '2026-01-01', end: '2026-10-08', deadline: '2026-12-15', status: 'Dalam Peninjauan', access: 'Belum Aktif', accessEnd: '2026-11-30', download: false, decisions: {}, history: [event], versions: [] },
    { id: 'RSET-003', owner: 'PEN-002', title: 'Analisis pemulihan fasilitas pascabencana', institution: 'Institut Riset Contoh', purpose: 'Analisis proses pemulihan fasilitas umum.', requestedGroups: ['pemulihan', 'progres'], area: 'all', start: '2026-01-01', end: '2026-09-30', deadline: '2026-10-20', status: 'Diajukan', access: 'Belum Aktif', accessEnd: '2026-10-31', download: false, decisions: {}, history: [event], versions: [] },
  ];
  return { schema: 1, researcherId: DEMO_USER, entries, research, reports: [], imports: [], users: [
    ...(['ADM', 'PK', 'KL', 'RR', 'SEK'] as Role[]).map(role => ({ id: `USER-${role}`, name: roles[role].person, email: `${role.toLowerCase()}@bpbd.example`, role, institution: 'BPBD Kota Semarang', status: 'Aktif', note: '', demoPassword: DEMO_PASSWORD })),
    { id: DEMO_USER, name: roles.PEN.person, email: 'nadia@peneliti.example', role: 'PEN', institution: 'Universitas Contoh Semarang', status: 'Aktif', note: '', demoPassword: DEMO_PASSWORD },
    { id: 'PEN-002', name: 'Arif Setiawan (Demo)', email: 'arif@peneliti.example', role: 'PEN', institution: 'Institut Riset Contoh', status: 'Menunggu Persetujuan', note: '', demoPassword: DEMO_PASSWORD },
  ], audit: [
    { id: 'AUD-001', role: 'KL', at: '2026-10-08T08:45:00+07:00', actor: roles.KL.person, action: 'Data kejadian diperbarui', object: 'KJD-047', before: 'Dalam penanganan', after: 'Selesai' },
    { id: 'AUD-002', role: 'SEK', at: '2026-10-07T15:30:00+07:00', actor: roles.SEK.person, action: 'Permohonan penelitian diperiksa', object: 'RSET-001' },
    { id: 'AUD-003', role: 'PK', at: '2026-10-07T10:15:00+07:00', actor: roles.PK.person, action: 'Data mitigasi disetujui', object: 'MIT-003' },
  ], masters: { wilayah: [...areas], bencana: [...hazards], satuan: ['orang', 'KK', 'paket', 'unit', 'dokumen', 'kegiatan', '%'] }, settings: { maxUploadMb: 5, reminderDays: 7, approval: true }, template: { version: 1, sections: ['Ringkasan cakupan', 'Ringkasan indikator', 'Rincian data', 'Catatan kondisi data', 'Tindak lanjut', 'Pengesahan'], history: [] }, reviewer: { PK: true, KL: true, RR: true }, adminOperational: false, profile: {} };
}
