import type { PoolClient } from 'pg';
import { tokenHash } from '../server/passwords.ts';
import { requireThat } from '../server/policy.ts';
import type { User } from '../bpbd/model.ts';

export async function account(client: PoolClient, request: Request): Promise<User> {
  const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('bpbd_session='))?.slice(13) || '';
  requireThat(/^[a-f0-9]{64}$/.test(token), 'Silakan login terlebih dahulu.', 401);
  const result = await client.query('SELECT u.data FROM bpbd_sessions s JOIN bpbd_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash(token)]);
  const actor = result.rows[0]?.data as User | undefined;
  requireThat(actor?.status === 'Aktif', 'Sesi berakhir atau akun belum aktif.', 401); return actor;
}
export function checkOrigin(request: Request) {
  if (['GET', 'HEAD'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  let valid = !origin;
  if (origin) try { const u = new URL(origin); valid = ['http:', 'https:'].includes(u.protocol) && u.host === request.headers.get('host')?.toLowerCase(); } catch { valid = false; }
  requireThat(request.headers.get('x-bpbd-request') === '1' && valid, 'Asal permintaan tidak diizinkan.');
}
export async function boundedBytes(request: Request, limit = 16 * 1024 * 1024) {
  const reader = request.body?.getReader(); const parts: Uint8Array[] = []; let total = 0;
  if (reader) while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length;
    if (total > limit) { await reader.cancel(); requireThat(false, 'Ukuran permintaan melebihi batas.', 413); } parts.push(value); }
  return Buffer.concat(parts);
}
