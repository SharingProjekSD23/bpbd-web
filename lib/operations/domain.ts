import definitions from './modules.json' with { type: 'json' };
import { randomUUID } from 'node:crypto';
import { ApiError, requireThat } from '../server/policy.ts';
import type { Role, User } from '../bpbd/model.ts';

export type Row = Record<string, unknown> & { id: string; revision?: number };
export type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] };
export type Module = { id: string; unit: string; title: string; description: string; fields: Field[] };
export const modules = definitions as Module[];
export const sharedLogistics = new Set(['barang', 'masuk', 'keluar', 'opname']);
export const internal = (role: Role) => ['PK', 'KL', 'RR', 'SEK'].includes(role);
export function moduleOf(id: string) {
  const result = modules.find(m => m.id === id);
  requireThat(result, 'Modul tidak dikenal.', 404); return result;
}
export function ownerOf(id: string): Role { const unit = moduleOf(id).unit; return (unit === 'SK' ? 'SEK' : unit) as Role; }
export function canReadModule(role: Role, id: string) {
  return internal(role) && (role === ownerOf(id) || role === 'SEK' || sharedLogistics.has(id));
}
export function canWriteModule(role: Role, id: string) { return internal(role) && role === ownerOf(id); }
export function allowed(actor: User, id: string, write = false) {
  requireThat(actor.status === 'Aktif' && (write ? canWriteModule(actor.role, id) : canReadModule(actor.role, id)), 'Akses bidang tidak diizinkan.');
}
export function visibleRow(role: Role, row: Row): Row {
  const copy = structuredClone(row);
  // A logistics link must never expose a private incident through another menu,
  // including past versions. The original relationship stays in PostgreSQL.
  if (!canReadModule(role, 'kejadian')) {
    delete copy.kejadian_id;
    delete copy.kejadian_ref;
    if (Array.isArray(copy.history)) copy.history = copy.history.map(r => visibleRow(role, r as Row));
  }
  return copy;
}
export const value = (row: Record<string, unknown>, key: string) => String(row[key] ?? '').trim();
export const number = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0);
export function validId(input: unknown) {
  const id = String(input ?? '');
  requireThat(id.length > 0 && id.length <= 200 && !/[\x00-\x1f/\\<>"']/.test(id), 'ID catatan tidak valid.', 400);
  return id;
}
export function validate(id: string, raw: Record<string, unknown>, records: Record<string, Row[]>): Row {
  const row: Row = { id: validId(raw.id || `${id.toUpperCase()}-${randomUUID()}`) };
  for (const field of moduleOf(id).fields) {
    const text = value(raw, field.key);
    requireThat(!field.required || text.length, `${field.label} wajib diisi.`, 400);
    if (!text) { row[field.key] = null; continue; }
    requireThat(text.length <= 10000, `Isian terlalu panjang: ${field.label}.`, 400);
    let parsed: unknown = text;
    let good = true;
    switch (field.type) {
      case 'integer': case 'number': {
        const n = Number(text.replace(',', '.'));
        good = Number.isFinite(n) && n >= 0 && n <= 1e15 && (field.type !== 'integer' || Number.isSafeInteger(n)); parsed = n; break;
      }
      case 'date': good = /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text; break;
      case 'time': good = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(text); break;
      case 'select': good = !!field.options?.includes(text); break;
      case 'barang': case 'kejadian': good = !!records[field.type]?.some(r => r.id === text); break;
      case 'url': try { const u = new URL(text); good = ['https:', 'http:'].includes(u.protocol); } catch { good = false; } break;
    }
    requireThat(good, `Nilai tidak valid: ${field.label}.`, 400); row[field.key] = parsed;
  }
  if (row.tahun != null) requireThat(number(row, 'tahun') >= 2000 && number(row, 'tahun') <= 2100, 'Tahun harus 2000–2100.', 400);
  for (const key of ['jumlah', 'tangki', 'liter', 'kapasitas']) if (row[key] != null) requireThat(number(row, key) > 0, `${key} harus lebih dari nol.`, 400);
  if (id === 'btt') for (const [flag, date] of [['asesmen_selesai', 'tanggal_selesai'], ['bendahara', 'tanggal_bendahara'], ['transfer', 'tanggal_transfer']]) {
    requireThat(row[date] == null || row[flag] === 'Ya', 'Tanggal tahap hanya diisi ketika tahap tersebut Ya.', 400);
  }
  return row;
}
export function stockOf(records: Record<string, Row[]>) {
  const stocks = new Map<string, Record<string, unknown>>();
  // K1 opening balances are explicit ledger rows, including unknown dates.
  for (const kind of ['masuk', 'keluar']) for (const row of records[kind] || []) {
    const key = JSON.stringify([row.barang, row.sumber]);
    const stock = stocks.get(key) || { barang: row.barang, sumber: row.sumber, masuk: 0, keluar: 0 };
    stock[kind] = Number(stock[kind]) + number(row, 'jumlah'); stocks.set(key, stock);
  }
  return [...stocks.values()].map(stock => {
    const item = records.barang?.find(r => r.id === stock.barang);
    requireThat(item, 'Relasi barang tidak ditemukan.', 409);
    const saldo = Number(stock.masuk) - Number(stock.keluar);
    return { ...stock, barang: String(stock.barang), sumber: String(stock.sumber), nama: item.nama, satuan: item.satuan, minimum: item.minimum, saldo,
      peringatan: item.minimum != null && saldo < Number(item.minimum) };
  });
}
export function checkStock(records: Record<string, Row[]>) {
  for (const stock of stockOf(records)) requireThat(stock.saldo >= 0, `Stok tidak cukup untuk ${stock.nama} / ${stock.sumber}. Tidak ada data disimpan.`, 409);
}
export function prepareBatch(module: string, incoming: Record<string, unknown>[], records: Record<string, Row[]>) {
  requireThat(incoming.length > 0 && incoming.length <= 5000, 'Gunakan 1–5.000 baris.', 400);
  const ids = new Set((records[module] || []).map(r => r.id));
  const prepared = incoming.map((raw, i) => {
    try {
      const row = validate(module, raw, records);
      requireThat(!ids.has(row.id), `ID sudah ada: ${row.id}`, 409); ids.add(row.id); return row;
    } catch (error) { if (error instanceof ApiError) throw new ApiError(error.status, `Baris ${i + 1}: ${error.message}`); throw error; }
  });
  if (['masuk', 'keluar'].includes(module)) checkStock({ ...records, [module]: [...(records[module] || []), ...prepared] });
  return prepared;
}
