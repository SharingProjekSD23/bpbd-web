import { isDeepStrictEqual as equal } from 'node:util';
import { z } from 'zod';
import { approvedGroups, authorizedResearchEntries, requestedResearchEntries, researchDataValidated, normalizePhone, canEdit, canRead, filterEntries, groups, isReviewer, researchStatuses, referenceDate, timestamp, uid, type Entry, type Research, type Store, type User } from '../bpbd/model.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function requireThat(condition: unknown, message = 'Tindakan tidak diizinkan.', status = 403): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
const str = z.string().max(20000);
const id = z.string().min(1).max(120).regex(/^[\w-]+$/);
const event = z.object({ at: str, actor: str, action: str, note: str.optional() }).strict();
const role = z.enum(['ADM', 'PK', 'KL', 'RR', 'SEK', 'PEN']);
const userSchema = z.object({ whatsappConsent: z.boolean().optional(), phone: z.string().max(40).refine(v => !v || !!normalizePhone(v), 'Nomor telepon tidak valid.').optional(), id, name: str.min(1), email: z.string().email().max(254), role, institution: str, status: z.enum(['Aktif', 'Nonaktif', 'Menunggu Persetujuan', 'Perlu Perbaikan', 'Ditolak']), note: str, demoPassword: z.string().max(256) }).strict();
const resultSchema = z.object({ id, at: str, filename: str, fileId: id, summary: str, feedback: str, review: str, note: str }).strict();
const decisionSchema = z.object({ status: z.enum(['Disetujui', 'Ditolak']), note: str, groups: z.array(str), download: z.boolean().optional(), accessEnd: str.optional(), validatedRows: z.array(z.object({ id, version: z.number().int().positive() }).strict()).optional() }).strict();
const researchSchema = z.object({ validation: z.object({ at: str, rows: z.array(z.object({ id, version: z.number().int().positive() }).strict()) }).strict().optional(), id, owner: id, title: str.min(1), institution: str, purpose: str, requestedGroups: z.array(str).min(1), area: str, start: str, end: str, deadline: str, status: z.enum(researchStatuses), access: str, accessEnd: str, download: z.boolean(), decisions: z.record(decisionSchema), history: z.array(event), versions: z.array(resultSchema), extension: z.object({ date: str, reason: str }).strict().optional(), supportingId: id.optional(), supportingName: str.optional(), complete: z.boolean().optional() }).strict();

export function scopeStore(store: Store, actor: User): Store {
  const scoped = structuredClone(store);
  const active = actor.status === 'Aktif';
  scoped.users = store.users.filter(u => u.id === actor.id || actor.role === 'ADM').map(u => ({ ...u, demoPassword: '' }));
  scoped.research = !active ? [] : store.research.filter(r => actor.role === 'ADM' || actor.role === 'SEK' || (actor.role === 'PEN' ? r.owner === actor.id : isReviewer(store, actor.role) && r.requestedGroups.some(g => groups[g]?.role === actor.role)));
  if (actor.role !== 'PEN' && actor.role !== 'ADM') {
    for (const r of scoped.research) {
      const owner = store.users.find(u => u.id === r.owner);
      if (owner && !scoped.users.some(u => u.id === owner.id)) scoped.users.push({ ...owner, email: '', note: '', demoPassword: '' });
    }
  }
  if (actor.role === 'PEN') {
    const allowed = new Set(scoped.research.flatMap(r => authorizedResearchEntries(store, r, actor.id)).map(e => e.id));
    scoped.entries = store.entries.filter(e => allowed.has(e.id)).map(e => ({ ...e, history: [], description: '', fileId: undefined, fileName: undefined, linkedId: undefined }));
  } else scoped.entries = store.entries.filter(e => canRead(actor.role, e.group));
  scoped.reports = store.reports.filter(r => canRead(actor.role, r.group));
  scoped.imports = store.imports.filter(r => canRead(actor.role, r.group));
  scoped.audit = actor.role === 'PEN' ? [] : store.audit.filter(e => actor.role === 'ADM' || e.role === actor.role);
  return JSON.parse(JSON.stringify(scoped));
}
function fields(before: object, after: object, allowed: string[]) {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    requireThat(allowed.includes(key) || equal((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]), `Perubahan kolom ${key} tidak diizinkan.`);
  }
}
function history(before: Entry['history'], after: Entry['history'], actor: User) {
  requireThat(after.length >= before.length && equal(after.slice(0, before.length), before), 'Riwayat lama tidak dapat diubah.');
  return [...before, ...after.slice(before.length).map(e => ({ ...e, at: timestamp(), actor: actor.name }))];
}
function validateResearch(store: Store, actor: User, old: Research | undefined, next: Research) {
  researchSchema.parse(next);
  let automaticValidation = false;
  requireThat(new Set(next.requestedGroups).size === next.requestedGroups.length && next.requestedGroups.every(g => !!groups[g] && groups[g].role !== 'SEK'), 'Kelompok data tidak valid.', 400);
  requireThat(next.start <= next.end && next.title.trim() && next.purpose.trim(), 'Isi permohonan tidak valid.', 400);
  if (actor.role === 'PEN') {
    requireThat(actor.status === 'Aktif' && next.owner === actor.id && (!old || old.owner === actor.id));
    if (!old) {
      requireThat(next.status === 'Diajukan' && next.access === 'Belum Aktif' && !next.download && !Object.keys(next.decisions).length);
      requireThat(equal(next.versions, []) && next.complete === undefined && next.extension === undefined);
      requireThat(next.validation === undefined, 'Catatan validasi dibuat otomatis oleh server.');
      next.validation = { at: timestamp(), rows: requestedResearchEntries(store, next).map(e => ({ id: e.id, version: e.version })) };
      automaticValidation = true;
    } else if (!equal(old.versions, next.versions)) {
      fields(old, next, ['versions', 'complete', 'history']);
      requireThat(approvedGroups(old).length > 0 && next.complete === false && next.versions.length === old.versions.length + 1 && equal(next.versions.slice(0, -1), old.versions));
      const version = next.versions.at(-1)!;
      requireThat(version.review === 'Belum Ditinjau' && version.note === '' && version.summary.trim() && version.feedback.trim());
      version.at = timestamp();
    } else {
      fields(old, next, ['extension', 'history']);
      requireThat(next.extension && next.extension.date > old.deadline && next.extension.reason.trim() && approvedGroups(old).length > 0);
    }
  } else {
    requireThat(old, 'Permohonan tidak ditemukan.', 404);
    requireThat(old.owner === next.owner);
    requireThat(actor.role === 'ADM', 'Seluruh verifikasi penelitian hanya dapat dilakukan Admin.');
    if (actor.role === 'ADM') {
      if (!equal(old.versions, next.versions)) {
        fields(old, next, ['versions', 'history']);
        requireThat(old.versions.length > 0 && next.versions.length === old.versions.length && equal(old.versions.slice(0, -1), next.versions.slice(0, -1)));
        fields(old.versions.at(-1)!, next.versions.at(-1)!, ['review', 'note']);
        requireThat(['Sedang Ditinjau', 'Perlu Perbaikan', 'Selesai Ditinjau'].includes(next.versions.at(-1)!.review) && next.versions.at(-1)!.note.trim());
      } else if (old.deadline !== next.deadline || !equal(old.extension, next.extension) || old.complete !== next.complete) {
        fields(old, next, ['deadline', 'history', 'extension', 'complete']);
        requireThat(/^\d{4}-\d{2}-\d{2}$/.test(next.deadline) && Number.isFinite(Date.parse(next.deadline)) && new Date(next.deadline).toISOString().slice(0,10) === next.deadline, 'Tenggat tidak valid.', 400);
        requireThat(!next.complete || next.versions.length > 0, 'Hasil penelitian belum diunggah.', 400);
      } else if (!equal(old.decisions, next.decisions)) {
        fields(old, next, ['decisions', 'status', 'download', 'accessEnd', 'history']);
        const decision = next.decisions.ADM;
        requireThat(Object.keys(next.decisions).length === 1 && decision && decision.note.trim(), 'Keputusan harus ditetapkan Admin Sistem.');
        requireThat(decision.groups.every(g => old.requestedGroups.includes(g)) && new Set(decision.groups).size === decision.groups.length, 'Dataset berada di luar permohonan.');
        requireThat(decision.status !== 'Disetujui' || decision.groups.length === old.requestedGroups.length, 'Persetujuan harus mencakup seluruh dataset yang diminta.');
        requireThat(decision.status !== 'Disetujui' || decision.accessEnd && decision.accessEnd >= referenceDate, 'Pilih masa akses yang valid.');
        requireThat(decision.status === 'Disetujui' || !decision.groups.length);
        decision.validatedRows = decision.status === 'Disetujui' ? requestedResearchEntries(store, old, decision.groups).map(e => ({ id:e.id, version:e.version })) : [];
        next.validation = { at:timestamp(), rows:requestedResearchEntries(store, old).map(e => ({ id:e.id, version:e.version })) };
        next.status = decision.status;
        next.download = decision.status === 'Disetujui' && decision.download === true;
        next.accessEnd = decision.accessEnd || old.accessEnd;
        // A changed decision requires explicit activation of the resulting permission.
        next.access = 'Belum Aktif';
      } else {
        fields(old, next, ['access', 'accessEnd', 'download', 'history']);
        requireThat(['Aktif', 'Dicabut', 'Berakhir', 'Belum Aktif'].includes(next.access));
        if (next.access === 'Aktif') {
          const grants = Object.values(old.decisions).filter(d => d.status === 'Disetujui');
          requireThat(old.status === 'Disetujui' && grants.length > 0);
          requireThat(researchDataValidated(store, old), 'Validasi baris data perlu diperbarui sebelum izin diaktifkan.');
          requireThat(next.accessEnd >= referenceDate && grants.every(d => next.accessEnd <= (d.accessEnd || old.accessEnd)), 'Masa izin melampaui keputusan persetujuan.');
          requireThat(!next.download || grants.every(d => d.download === true), 'Hak unduh belum disetujui.');
        }
      }
    }
  }
  next.history = history(old?.history || [], next.history, actor);
  if (automaticValidation) next.history.push({ at: next.validation!.at, actor: 'Sistem', action: 'Seluruh baris data divalidasi otomatis', note: next.validation!.rows.length + ' baris sesuai dataset, wilayah, dan periode permohonan.' });
}

// Clients send their visible snapshot. Only validated differences are merged
// into the complete server state; hidden records can never be overwritten.
export function mergeStore(store: Store, submitted: Store, actor: User, action: string, object: string): Store {
  requireThat(submitted && typeof submitted === 'object', 'Data tidak valid.', 400);
  const visible = scopeStore(store, actor);
  const next = structuredClone(store);
  fields(visible, submitted, ['users', 'entries', 'research', 'reports', 'imports', 'masters', 'settings', 'reviewer', 'adminOperational', 'template']);
  for (const name of ['users', 'entries', 'research', 'reports', 'imports'] as const) {
    const incoming = submitted[name];
    requireThat(Array.isArray(incoming) && incoming.length <= 20000 && new Set(incoming.map(row => row.id)).size === incoming.length, 'Daftar data tidak valid.', 400);
    for (const old of visible[name]) requireThat(incoming.some(row => row.id === old.id), 'Penghapusan data tidak didukung; gunakan arsip.');
    for (const item of incoming) {
      id.parse(item.id);
      const seen = visible[name].find(row => row.id === item.id);
      if (equal(seen, item)) continue;
      const old = store[name].find(row => row.id === item.id);
      requireThat(!old || seen, 'Data di luar cakupan akses.');
      const row = structuredClone(item);
      if (name === 'users') {
        const user = row as User;
        userSchema.parse(user);
        requireThat(actor.role === 'ADM' || user.id === actor.id && !!old);
        if (actor.role !== 'ADM') fields(old!, user, ['name', 'email', 'institution', ...(actor.role === 'PEN' ? ['phone', 'whatsappConsent'] : [])]);
        requireThat(!user.demoPassword || user.demoPassword.length >= 8, 'Kata sandi minimal 8 karakter.', 400);
        requireThat(old || user.demoPassword.length >= 8, 'Kata sandi akun baru wajib diisi.', 400);
        if (user.phone) user.phone = normalizePhone(user.phone);
        user.email = user.email.trim().toLowerCase();
        requireThat(!store.users.some(u => u.id !== user.id && u.email.toLowerCase() === user.email), 'Email sudah digunakan.', 409);
      } else {
        requireThat(actor.status === 'Aktif');
        if (name === 'entries') {
          throw new ApiError(403, 'Gunakan modul Operasional atau Logistik untuk pencatatan baru. Dataset penelitian lama tetap dipertahankan.');
        } else if (name === 'research') validateResearch(store, actor, old as Research | undefined, row as Research);
        else if (name === 'reports') {
          const report = row as Store['reports'][number];
          requireThat(!old && canRead(actor.role, report.group));
          const rows = filterEntries(store.entries.filter(e => e.group === report.group && e.status === 'Disetujui'), report.filters);
          requireThat(rows.length > 0, 'Tidak ada data disetujui untuk laporan.', 400);
          report.rows = rows; report.role = actor.role; report.actor = actor.name; report.created = timestamp();
          report.sections = [...store.template.sections]; report.templateVersion = store.template.version;
        } else if (name === 'imports') {
          const job = row as Store['imports'][number];
          requireThat(!old && canEdit(store, actor.role, job.group));
          requireThat(typeof job.fingerprint === 'string' && !store.imports.some(i => i.fingerprint === job.fingerprint), 'Batch sudah diimpor.', 409);
          requireThat(Array.isArray(job.ids) && job.ids.length === job.count && job.ids.every(key => next.entries.some(e => e.id === key && e.group === job.group) && !store.entries.some(e => e.id === key)), 'Isi batch tidak sesuai.', 400);
          job.actor = actor.name; job.at = timestamp(); job.status = 'Berhasil';
        }
      }
      const list = next[name] as { id: string }[];
      const index = list.findIndex(r => r.id === row.id);
      if (index >= 0) list[index] = row; else list.push(row);
    }
  }
  for (const key of ['masters', 'settings', 'reviewer', 'adminOperational', 'template'] as const) {
    if (equal(visible[key], submitted[key])) continue;
    requireThat(actor.status === 'Aktif' && (key === 'template' ? actor.role === 'SEK' : actor.role === 'ADM'));
    if (key === 'settings') z.object({ maxUploadMb: z.number().int().min(1).max(10), reminderDays: z.number().int().min(1).max(30), approval: z.boolean() }).strict().parse(submitted[key]);
    if (key === 'reviewer') requireThat(false, 'Verifikasi penelitian ditetapkan pada Admin.');
    if (key === 'adminOperational') z.boolean().parse(submitted[key]);
    if (key === 'masters') z.record(z.array(str)).parse(submitted[key]);
    if (key === 'template') {
      z.object({ version: z.number().int(), sections: z.array(str.min(1)).min(1).max(50), history: z.array(event) }).strict().parse(submitted[key]);
      submitted.template.version = store.template.version + 1;
      submitted.template.history = history(store.template.history, submitted.template.history, actor);
    }
    (next as unknown as Record<string, unknown>)[key] = structuredClone(submitted[key]);
  }
  requireThat(next.users.some(u => u.role === 'ADM' && u.status === 'Aktif'), 'Minimal satu Admin aktif harus tersedia.', 400);
  requireThat(new Set(next.users.map(u => u.email.toLowerCase())).size === next.users.length, 'Email sudah digunakan.', 409);
  next.audit.unshift({ id: uid('AUD'), at: timestamp(), actor: actor.name, role: actor.role, action: action.slice(0, 250) || 'Data diperbarui', object: object.slice(0, 120) || 'sistem' });
  return next;
}
