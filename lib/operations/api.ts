import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoolClient } from 'pg';
import { getPool } from '../../db/index.ts';
import { ApiError, requireThat } from '../server/policy.ts';
import { account, checkOrigin, boundedBytes } from './auth.ts';
import { modules, internal, canReadModule, canWriteModule, allowed, visibleRow, prepareBatch, validate, checkStock, stockOf, type Row } from './domain.ts';
import { readRecords, saveRecord, audit } from './repository.ts';
import { parseSheet, exportSheet } from './spreadsheets.ts';

const hash = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const json = (data: unknown, status = 200) => Response.json(data, { status });
export async function handleOperations(request: Request) {
  let client: PoolClient | undefined, transaction = false;
  try {
    checkOrigin(request);
    client = await getPool().connect();
    await client.query(request.method === 'GET' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'); transaction = true;
    const actor = await account(client, request);
    const path = new URL(request.url), parts = path.pathname.split('/api/operasional/')[1]?.split('/').map(decodeURIComponent) || [];
    const [kind, module, id] = parts;
    if (kind === 'legacy-research' && request.method === 'GET') {
      requireThat(actor.role === 'ADM');
      const result = await client.query("SELECT source_id,data FROM bpbd_source_records WHERE source='K1' AND entity='permintaan_data' ORDER BY source_id");
      await client.query('COMMIT'); transaction = false;
      return Response.json(result.rows, { headers: { 'Cache-Control': 'no-store' } });
    }
    requireThat(internal(actor.role), 'Akses operasional tidak diberikan untuk akun ini.');
    const write = !['GET', 'HEAD'].includes(request.method);
    // All stock-affecting operations and migration batches share a DB lock.
    // Unlike an in-process mutex this also works across multiple server workers.
    if (write) await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-operasional'))");
    let result: Response;
    if (kind === 'source-files' && request.method === 'GET') {
      const list = await client.query('SELECT id,name,mime,owner_role,sha256 FROM bpbd_source_files WHERE owner_role=$1 OR $1=\'SEK\'', [actor.role]);
      if (!module) result = json(list.rows);
      else {
        const file = list.rows.find(f => f.id === module); requireThat(file, 'Berkas tidak ditemukan.', 404);
        const bytes = await client.query('SELECT content FROM bpbd_source_files WHERE id=$1', [module]);
        result = new Response(new Uint8Array(bytes.rows[0].content), { headers: { 'Content-Type': file.mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` } });
      }
    } else if (kind === 'assets' && request.method === 'GET') {
      requireThat(['index.html', 'app.js', 'style.css'].includes(module) && parts.length === 2, 'Berkas tidak ditemukan.', 404);
      const content = await readFile(join(process.cwd(), 'integration/kelompok3', module), 'utf8');
      result = new Response(content, { headers: { 'Content-Type': ({ 'index.html': 'text/html;charset=utf-8', 'app.js': 'text/javascript;charset=utf-8', 'style.css': 'text/css;charset=utf-8' } as Record<string, string>)[module],
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'" } });
    } else if (kind === 'config' && request.method === 'GET') {
      result = json({ workspace: 'operasional', storage: 'PostgreSQL lokal', version: 'integrasi-1', actor: { name: actor.name, role: actor.role },
        modules: modules.filter(m => canReadModule(actor.role, m.id)).map(m => ({ ...m, writable: canWriteModule(actor.role, m.id) })) });
    } else {
      const records = await readRecords(client);
      const visible = (m: string) => records[m].map(r => visibleRow(actor.role, r));
      if (kind === 'records') {
        allowed(actor, module, write);
        if (request.method === 'GET') result = json(visible(module));
        else {
          requireThat(['POST', 'PUT'].includes(request.method), 'Metode tidak didukung.', 405);
          requireThat(request.headers.get('content-type')?.includes('application/json'), 'Gunakan JSON.', 415);
          const raw = JSON.parse((await boundedBytes(request, 1024 * 1024)).toString('utf8'));
          requireThat(raw && typeof raw === 'object' && !Array.isArray(raw), 'Catatan tidak valid.', 400);
          const now = new Date().toISOString(); let row: Row;
          if (request.method === 'PUT') {
            const old = records[module].find(r => r.id === id); requireThat(old, 'Catatan tidak ditemukan.', 404);
            requireThat(raw.revision === (old.revision || 1), 'Data sudah berubah. Muat ulang sebelum menyimpan.', 409);
            requireThat(module !== 'opname', 'Stok opname adalah snapshot. Tambahkan pemeriksaan baru untuk koreksi.', 400);
            if (!canReadModule(actor.role, 'kejadian')) raw.kejadian_id = old.kejadian_id;
            row = { ...old, ...validate(module, { ...raw, id }, records), created_at: old.created_at, updated_at: now, updated_by: actor.id, revision: (old.revision || 1) + 1 };
            if (module === 'barang' && old.satuan !== row.satuan) requireThat(![...records.masuk,...records.keluar].some(r => r.barang === id), 'Satuan barang tidak dapat diubah setelah transaksi tersedia.', 409);
            const { history: oldHistory, ...snapshot } = old;
            row.history = [...(Array.isArray(oldHistory) ? oldHistory : []), snapshot];
            if (['masuk', 'keluar'].includes(module)) checkStock({ ...records, [module]: records[module].map(r => r.id === id ? row : r) });
          } else {
            row = { ...prepareBatch(module, [raw], records)[0], created_at: now, updated_at: now, created_by: actor.id, revision: 1 };
            if (module === 'opname') { row.buku = stockOf(records).find(s => s.barang === row.barang && s.sumber === row.sumber)?.saldo || 0; row.selisih = Number(row.fisik) - Number(row.buku); }
          }
          await saveRecord(client, module, row); await audit(client, actor, 'Catatan operasional disimpan', `${module}/${row.id}`); result = json(visibleRow(actor.role, row), request.method === 'POST' ? 201 : 200);
        }
      } else if (kind === 'transactions' && request.method === 'POST') {
        allowed(actor, 'masuk', true);
        const body = JSON.parse((await boundedBytes(request, 1024 * 1024)).toString('utf8'));
        requireThat(['masuk', 'keluar'].includes(body.module) && Array.isArray(body.rows), 'Transaksi tidak valid.', 400);
        const prepared = prepareBatch(body.module, body.rows, records);
        for (const row of prepared) await saveRecord(client, body.module, { ...row, revision: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: actor.id });
        await audit(client, actor, 'Transaksi logistik disimpan', `${prepared.length} rincian`); result = json({ saved: prepared.length }, 201);
      } else if (kind === 'stock' && request.method === 'GET') result = json(stockOf(records));
      else if (kind === 'dashboard' && request.method === 'GET') {
        const source = await client.query("SELECT entity,source_id,data FROM bpbd_source_records WHERE source='K1' ORDER BY entity,source_id");
        const entityOwner: Record<string, string> = { master_barang: 'barang', logistik_transaksi: 'masuk', kejadian_bencana: 'kejadian', master_wilayah: 'barang', mitigasi_bencana: 'pencegahan', pascabencana: 'btt' };
        const archive = source.rows.filter(r => entityOwner[r.entity] && canReadModule(actor.role, entityOwner[r.entity])).map(r => ({ ...r, data: !canReadModule(actor.role, 'kejadian') ? Object.fromEntries(Object.entries(r.data).filter(([key]) => !/kejadian|bencana_id/.test(key))) : r.data }));
        result = json({ role: actor.role, writable: actor.role === 'KL', stock: stockOf(records),
          records: Object.fromEntries(modules.filter(m => canReadModule(actor.role, m.id)).map(m => [m.id, visible(m.id)])), archive });
      } else if (kind === 'import' && request.method === 'POST') {
        allowed(actor, module, true);
        const data = await new Response(await boundedBytes(request), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
        const file = data.get('file'); requireThat(file instanceof File, 'Pilih berkas.', 400);
        const fingerprint = hash(Buffer.concat([Buffer.from(module + '\0'), Buffer.from(await file.arrayBuffer())]));
        const duplicate = await client.query('SELECT 1 FROM bpbd_op_imports WHERE fingerprint=$1', [fingerprint]); requireThat(!duplicate.rowCount, 'Batch ini sudah diimpor.', 409);
        const prepared = prepareBatch(module, await parseSheet(module, file), records);
        if (id === 'preview') result = json({ count: prepared.length, rows: prepared.slice(0, 10) });
        else {
          for (const item of prepared) {
            const row: Row = { ...item, revision: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: actor.id };
            if (module === 'opname') { row.buku = stockOf(records).find(s => s.barang === row.barang && s.sumber === row.sumber)?.saldo || 0; row.selisih = Number(row.fisik) - Number(row.buku); }
            await saveRecord(client, module, row);
          }
          await client.query('INSERT INTO bpbd_op_imports(fingerprint,module,count,actor) VALUES($1,$2,$3,$4)', [fingerprint, module, prepared.length, actor.id]);
          await audit(client, actor, 'Impor operasional', `${module}: ${prepared.length} baris`); result = json({ saved: prepared.length });
        }
      } else if (kind === 'export' && ['GET','POST'].includes(request.method)) {
        allowed(actor, module);
        const body = request.method === 'POST' ? JSON.parse((await boundedBytes(request,1024*1024)).toString('utf8')) : null;
        const ids = body?.ids ?? path.searchParams.getAll('ids'), template = request.method === 'GET' && path.searchParams.get('template') === 'true';
        requireThat(Array.isArray(ids) && ids.length <= 5000 && ids.every(id => typeof id === 'string'), 'Daftar ekspor tidak valid.',400);
        const selected = new Set(ids);
        result = await exportSheet(module, template ? [] : visible(module).filter(r => !ids.length || selected.has(r.id)), body?.format || path.searchParams.get('format') || 'xlsx', template, !canReadModule(actor.role, 'kejadian'));
      } else if (kind === 'attachments') {
        if (request.method === 'GET') {
          const files = (await client.query('SELECT id,module,data FROM bpbd_op_files')).rows.filter(f => canReadModule(actor.role, f.module));
          if (!module) result = json(files.map(f => f.data));
          else {
            const file = files.find(f => f.id === module); requireThat(file, 'Lampiran tidak ditemukan.', 404);
            const bytes = await client.query('SELECT content FROM bpbd_op_files WHERE id=$1', [module]);
            result = new Response(new Uint8Array(bytes.rows[0].content), { headers: { 'Content-Type': file.data.type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.data.name)}` } });
          }
        } else {
          requireThat(request.method === 'POST', 'Metode tidak didukung.', 405); allowed(actor, module, true);
          requireThat(records[module].some(r => r.id === id), 'Catatan tidak ditemukan.', 404);
          const form = await new Response(await boundedBytes(request, 11 * 1024 * 1024), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
          const file = form.get('file'); requireThat(file instanceof File && file.size > 0 && file.size <= 10 * 1024 * 1024, 'Lampiran maksimal 10 MB.', 400);
          const bytes = Buffer.from(await file.arrayBuffer());
          const ext = bytes.subarray(0, 5).toString() === '%PDF-' ? 'pdf' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg' : '';
          requireThat(ext && file.name.length <= 255 && !/[\x00-\x1f]/.test(file.name), 'Gunakan PDF, JPG, atau PNG yang valid.', 400);
          const meta = { id: randomUUID(), module, record: id, name: file.name, ext, type: ext === 'pdf' ? 'application/pdf' : ext === 'jpg' ? 'image/jpeg' : 'image/png', created_at: new Date().toISOString() };
          await client.query('INSERT INTO bpbd_op_files(id,module,record_id,data,content,sha256) VALUES($1,$2,$3,$4,$5,$6)', [meta.id, module, id, JSON.stringify(meta), bytes, hash(bytes)]);
          await audit(client, actor, 'Lampiran operasional diunggah', `${module}/${id}`); result = json(meta, 201);
        }
      } else if (kind === 'backup' && request.method === 'GET') {
        // A scoped JSON archive contains original metadata and base64 file bytes.
        // Full disaster-recovery backups use pg_dump, not this user export.
        const files = (await client.query('SELECT module,data,content,sha256 FROM bpbd_op_files')).rows.filter(f => canReadModule(actor.role, f.module)).map(f => ({ ...f.data, sha256: f.sha256, content_base64: f.content.toString('base64') }));
        result = new Response(JSON.stringify({ format: 'bpbd-operasional-1', at: new Date().toISOString(), role: actor.role, records: Object.fromEntries(modules.filter(m => canReadModule(actor.role, m.id)).map(m => [m.id, visible(m.id)])), files }, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=cadangan-pencatatan.json' } });
      } else throw new ApiError(404, 'Endpoint tidak ditemukan.');
    }
    await client.query('COMMIT'); transaction = false;
    result.headers.set('Cache-Control', 'no-store'); result.headers.set('X-Content-Type-Options', 'nosniff'); result.headers.set('X-Frame-Options', 'SAMEORIGIN'); return result;
  } catch (error) {
    if (transaction) await client?.query('ROLLBACK').catch(() => {});
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    if (error instanceof SyntaxError) return json({ error: 'JSON tidak valid.' }, 400);
    console.error('Operasional gagal:', (error as { code?: string }).code || (error as Error).name);
    return json({ error: 'Operasi gagal. Periksa layanan PostgreSQL atau format berkas.' }, 503);
  } finally { client?.release(); }
}
