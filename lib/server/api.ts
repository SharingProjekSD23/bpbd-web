import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { z, ZodError } from 'zod';
import { getPool } from '../../db/index.ts';
import { sessionUser, timestamp, uid, type Store, type User } from '../bpbd/model.ts';
import { validateDocument } from '../bpbd/files';
import { ApiError, mergeStore, requireThat, scopeStore } from './policy.ts';
import { readStore, writeStore } from './repository.ts';
import { tokenHash, verifyPassword } from './passwords.ts';

const cookieName = 'bpbd_session';
const sessionSeconds = 8 * 60 * 60;
const attempts = new Map<string, { count: number; until: number }>();
const response = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
function cookie(request: Request, token: string, age = sessionSeconds) {
  return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function requestToken(request: Request) {
  return request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
}
async function bytes(request: Request, limit: number) {
  const chunks: Uint8Array[] = []; let total = 0;
  const reader = request.body?.getReader();
  if (reader) while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.length;
    if (total > limit) { await reader.cancel(); throw new ApiError(413, 'Ukuran permintaan melebihi batas.'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function json(request: Request) {
  requireThat(request.headers.get('content-type')?.includes('application/json'), 'Gunakan JSON.', 415);
  try { return JSON.parse((await bytes(request, 10 * 1024 * 1024)).toString('utf8')); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'JSON tidak valid.'); }
}
async function account(client: PoolClient, request: Request, store: Store) {
  const token = requestToken(request);
  requireThat(/^[a-f0-9]{64}$/.test(token), 'Silakan login terlebih dahulu.', 401);
  const result = await client.query('SELECT user_id FROM bpbd_sessions WHERE token_hash=$1 AND expires_at>now()', [tokenHash(token)]);
  const user = sessionUser(store, result.rows[0]?.user_id || null);
  requireThat(user, 'Sesi berakhir. Silakan login kembali.', 401);
  return user;
}
async function newSession(client: PoolClient, user: User) {
  const token = randomBytes(32).toString('hex');
  await client.query('DELETE FROM bpbd_sessions WHERE expires_at<=now()');
  await client.query("INSERT INTO bpbd_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '8 hours')", [tokenHash(token), user.id]);
  return token;
}
function referencedFiles(store: Store) {
  return new Set([
    ...store.entries.map(e => e.fileId),
    ...store.research.flatMap(r => [r.supportingId, ...r.versions.map(v => v.fileId)]),
  ].filter((value): value is string => !!value));
}
export async function handleApi(request: Request) {
  let client: PoolClient | undefined;
  let transaction = false;
  try {
    const path = new URL(request.url).pathname.split('/api/bpbd/')[1] || '';
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      // Next may construct request.url with its internal hostname. Browser
      // Origin must match the actual Host header, including its port.
      let sameOrigin = !origin;
      if (origin) {
        try { const source = new URL(origin); sameOrigin = ['http:', 'https:'].includes(source.protocol) && source.host === request.headers.get('host')?.toLowerCase(); }
        catch { sameOrigin = false; }
      }
      requireThat(request.headers.get('x-bpbd-request') === '1' && sameOrigin, 'Asal permintaan tidak diizinkan.');
    }
    client = await getPool().connect();
    // A consistent read transaction prevents snapshots spanning two commits.
    await client.query(request.method === 'GET' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    transaction = true;
    const snapshot = await readStore(client, request.method !== 'GET');
    const { store } = snapshot;
    let result: Response;
    if (path === 'login' && request.method === 'POST') {
      const input = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }).strict().parse(await json(request));
      const email = input.email.trim().toLowerCase();
      const previous = attempts.get(email);
      const attempt = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 15 * 60000 };
      requireThat(attempt.count < 20, 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.', 429);
      attempt.count++; attempts.set(email, attempt);
      if (attempts.size > 5000) for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
      const record = await client.query('SELECT id,password_hash FROM bpbd_users WHERE email=$1', [email]);
      const user = sessionUser(store, record.rows[0]?.id || null);
      const valid = record.rows[0] && await verifyPassword(input.password, record.rows[0].password_hash);
      requireThat(user && valid, 'Email atau kata sandi tidak sesuai, atau akun dinonaktifkan.', 401);
      attempts.delete(email);
      await client.query('DELETE FROM bpbd_sessions WHERE token_hash=$1', [tokenHash(requestToken(request))]);
      const token = await newSession(client, user);
      result = response({ store: scopeStore(store, user), revision: snapshot.revision, userId: user.id }, 200, { 'Set-Cookie': cookie(request, token) });
    } else if (path === 'register' && request.method === 'POST') {
      const input = z.object({ name: z.string().trim().min(1).max(200), email: z.string().email().max(254), institution: z.string().trim().min(1).max(300), purpose: z.string().trim().min(1).max(5000), password: z.string().min(8).max(256), consent: z.literal(true) }).strict().parse(await json(request));
      requireThat(!store.users.some(u => u.email.toLowerCase() === input.email.toLowerCase()), 'Email sudah digunakan.', 409);
      const user: User = { id: uid('PEN'), name: input.name, email: input.email.trim().toLowerCase(), institution: input.institution, note: input.purpose, role: 'PEN', status: 'Menunggu Persetujuan', demoPassword: input.password };
      const next = structuredClone(store); next.users.push(user);
      next.audit.unshift({ id: uid('AUD'), at: timestamp(), actor: user.name, role: 'PEN', action: 'Pendaftaran peneliti diajukan', object: user.id });
      await writeStore(client, store, next);
      const token = await newSession(client, user);
      result = response({ store: scopeStore(next, user), revision: snapshot.revision + 1, userId: user.id }, 201, { 'Set-Cookie': cookie(request, token) });
    } else if (path === 'logout' && request.method === 'POST') {
      await client.query('DELETE FROM bpbd_sessions WHERE token_hash=$1', [tokenHash(requestToken(request))]);
      result = response({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
    } else {
      const user = await account(client, request, store);
      if (path === 'state' && request.method === 'GET') {
        result = response({ store: scopeStore(store, user), revision: snapshot.revision, userId: user.id });
      } else if (path === 'state' && request.method === 'PUT') {
        const input = z.object({ revision: z.number().int(), store: z.unknown(), action: z.string().max(250), object: z.string().max(120) }).strict().parse(await json(request));
        requireThat(input.revision === snapshot.revision, 'Data sudah diperbarui pengguna lain. Data terbaru dimuat; tinjau kembali isian sebelum menyimpan.', 409);
        const next = mergeStore(store, input.store as Store, user, input.action, input.object);
        const visibleFiles = referencedFiles(scopeStore(store, user));
        for (const fileId of referencedFiles(next)) {
          if (visibleFiles.has(fileId) || referencedFiles(store).has(fileId) && isDeepStrictEqual(store.entries, next.entries) && isDeepStrictEqual(store.research, next.research)) continue;
          // Unchanged hidden records do not need new attachment authorization.
          const changed = next.entries.some(e => e.fileId === fileId && !isDeepStrictEqual(store.entries.find(o => o.id === e.id)?.fileId, fileId)) || next.research.some(r => (r.supportingId === fileId || r.versions.some(v => v.fileId === fileId)) && !referencedFiles({ ...store, entries: [], research: store.research.filter(o => o.id === r.id) }).has(fileId));
          if (!changed) continue;
          const found = await client.query('SELECT 1 FROM bpbd_files WHERE id=$1 AND owner_id=$2', [fileId, user.id]);
          requireThat(found.rowCount, 'Dokumen tidak tersedia atau bukan milik akun ini.');
        }
        await writeStore(client, store, next);
        const updatedUser = sessionUser(next, user.id);
        result = response({ store: updatedUser ? scopeStore(next, updatedUser) : null, revision: snapshot.revision + 1, userId: updatedUser?.id || null });
      } else if (/^files\/[\w-]+$/.test(path)) {
        const fileId = path.slice(6);
        if (request.method === 'PUT') {
          requireThat(user.status === 'Aktif');
          const name = decodeURIComponent(request.headers.get('x-file-name') || '');
          requireThat(name.length > 0 && name.length <= 255 && !/[\/\\\x00-\x1f]/.test(name), 'Nama berkas tidak valid.', 400);
          const data = await bytes(request, store.settings.maxUploadMb * 1024 * 1024);
          const mime = /\.pdf$/i.test(name) ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          const file = new File([data], name, { type: mime });
          try { await validateDocument(file, store.settings.maxUploadMb); } catch (error) { throw new ApiError(400, (error as Error).message); }
          await client.query('INSERT INTO bpbd_files (id,owner_id,name,mime,content) VALUES ($1,$2,$3,$4,$5)', [fileId, user.id, name, mime, data]);
          result = response({ id: fileId }, 201);
        } else if (request.method === 'GET') {
          const record = await client.query('SELECT owner_id,name,mime,content FROM bpbd_files WHERE id=$1', [fileId]);
          requireThat(record.rowCount, 'Berkas tidak ditemukan.', 404);
          requireThat(user.status === 'Aktif' && (record.rows[0].owner_id === user.id || referencedFiles(scopeStore(store, user)).has(fileId)));
          const file = record.rows[0];
          result = new Response(new Uint8Array(file.content), { headers: { 'Content-Type': file.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
        } else throw new ApiError(405, 'Metode tidak didukung.');
      } else throw new ApiError(404, 'Endpoint tidak ditemukan.');
    }
    await client.query('COMMIT'); transaction = false;
    return result;
  } catch (error) {
    if (transaction) await client?.query('ROLLBACK').catch(() => {});
    if (error instanceof ApiError) return response({ error: error.message }, error.status);
    if (error instanceof ZodError) return response({ error: 'Isian permintaan tidak valid. Periksa kembali data.' }, 400);
    const code = (error as { code?: string }).code;
    if (code === '23505') return response({ error: 'Data sudah tersimpan atau ada nilai yang sama. Muat ulang lalu periksa kembali.' }, 409);
    // Never return driver messages or connection settings to the browser.
    console.error('BPBD API gagal:', code || (error as Error).name);
    return response({ error: 'Database belum dapat diakses. Periksa PostgreSQL, .env.local, dan jalankan npm run db:setup.' }, 503);
  } finally { client?.release(); }
}
