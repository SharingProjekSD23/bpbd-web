import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { request as playwrightRequest } from '@playwright/test';

const database = `bpbd_test_${randomBytes(6).toString('hex')}`;
const environment = { ...process.env, PGDATABASE: database, BPBD_INTEGRATION_TEST: '1', NEXT_TELEMETRY_DISABLED: '1' };
let server, adminPool, testPool, baseURL, created = false;
let output = '';
const contexts = [];
async function context() {
  const value = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { 'X-BPBD-Request': '1' } });
  contexts.push(value); return value;
}
async function login(email) {
  const value = await context();
  const response = await value.post('/api/bpbd/login', { headers: { Origin: baseURL }, data: { email, password: 'BPBDdemo2026!' } });
  assert.equal(response.status(), 200, await response.text());
  return value;
}
async function state(ctx) { const res = await ctx.get('/api/bpbd/state'); assert.equal(res.status(),200,await res.text());return res.json(); }
async function save(ctx, snapshot, edit, status = 200) {
  const copy = structuredClone(snapshot); edit(copy.store);
  const res = await ctx.put('/api/bpbd/state', { data: { store: copy.store, revision: copy.revision, action: 'Uji integrasi', object: 'test' } });
  assert.equal(res.status(), status, await res.text()); return res.json();
}
before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Jalankan npm run build sampai berhasil sebelum test:postgres.');
  assert.ok(process.env.PGUSER && process.env.PGDATABASE, 'Lengkapi .env.local terlebih dahulu.');
  adminPool = new pg.Pool({ database: 'postgres', connectionTimeoutMillis: 5000 });
  await adminPool.query(`CREATE DATABASE "${database}"`); created = true;
  execFileSync(process.execPath, ['scripts/setup-db.ts'], { env: environment, stdio: 'pipe', timeout: 30000 });
  testPool = new pg.Pool({ database });
  const probe = createServer();await new Promise(resolve => probe.listen(0,'127.0.0.1',resolve));
  const port = probe.address().port;await new Promise(resolve => probe.close(resolve));
  baseURL = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)], { env: environment, stdio: ['ignore','pipe','pipe'], windowsHide: true });
  for (const stream of [server.stdout,server.stderr]) stream.on('data', chunk => {output=(output+chunk).slice(-20000);});
  let ready = false;
  for (let i=0;i<80;i++) {
    try { if ((await fetch(`${baseURL}/api/bpbd/state`)).status===401) {ready=true;break;} } catch {}
    if(server.exitCode!==null)break;
    await delay(250);
  }
  assert.ok(ready, `Server uji tidak siap. ${output}`);
}, { timeout: 60000 });
after(async () => {
  await Promise.all(contexts.map(ctx=>ctx.dispose()));
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]); }
  await testPool?.end();
  // Only the uniquely named database created by this test process is removed.
  if (created && /^bpbd_test_[a-f0-9]{12}$/.test(database)) {
    await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [database]);
    await adminPool.query(`DROP DATABASE "${database}"`);
  }
  await adminPool?.end();
});
test('API sessions, cookie flags, password hashing, CSRF and scope enforcement', async () => {
  const anon=await context();assert.equal((await anon.get('/api/bpbd/state')).status(),401);
  const missingHeader=await fetch(`${baseURL}/api/bpbd/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'adm@bpbd.example',password:'BPBDdemo2026!'})});
  assert.equal(missingHeader.status,403);
  const foreign=await anon.post('/api/bpbd/login',{headers:{Origin:'https://unrelated.example'},data:{email:'adm@bpbd.example',password:'BPBDdemo2026!'}});
  assert.equal(foreign.status(),403);
  const ctx=await login('kl@bpbd.example'),snapshot=await state(ctx);
  assert.ok(snapshot.store.entries.every(e=>['kejadian','korban','kebutuhan','logistik','distribusi'].includes(e.group)));
  assert.ok(snapshot.store.users.every(u=>u.demoPassword===''));
  const cookies=(await ctx.storageState()).cookies;assert.ok(cookies.some(c=>c.name==='bpbd_session'&&c.httpOnly&&c.sameSite==='Strict'));
  const hashes=await testPool.query('SELECT password_hash,data FROM bpbd_users');
  assert.ok(hashes.rows.every(r=>r.password_hash.startsWith('scrypt:')&&!JSON.stringify(r.data).includes('BPBDdemo2026!')));
  await save(ctx,snapshot,s=>{s.users.find(u=>u.id==='USER-KL').role='ADM';},403);
});
test('Two sessions share committed records and stale writes are rejected atomically', async () => {
  const a=await login('kl@bpbd.example'),b=await login('kl@bpbd.example');
  const first=await state(a),stale=await state(b);
  await save(a,first,s=>{const e=s.entries.find(e=>e.id==='KJD-001');e.title='Data bersama dari PostgreSQL';e.status='Menunggu Persetujuan';});
  assert.equal((await state(b)).store.entries.find(e=>e.id==='KJD-001').title,'Data bersama dari PostgreSQL');
  await save(b,stale,s=>{s.entries[0].title='Tidak boleh menimpa';},409);
  const saved=await testPool.query('SELECT data FROM bpbd_entries WHERE id=$1',['KJD-001']);
  assert.equal(saved.rows[0].data.title,'Data bersama dari PostgreSQL');
  const admin=await login('adm@bpbd.example');
  await save(admin,await state(admin),s=>{s.entries.find(e=>e.id==='KJD-001').status='Disetujui';});
  assert.equal((await state(a)).store.entries.find(e=>e.id==='KJD-001').status,'Disetujui');
});
test('Uploaded documents persist in PostgreSQL and downloads enforce field access', async () => {
  const owner=await login('kl@bpbd.example'),peer=await login('kl@bpbd.example'),other=await login('pk@bpbd.example');
  const fileId='FILE-integration',document=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
  const upload=await owner.put(`/api/bpbd/files/${fileId}`,{headers:{'X-File-Name':'uji.pdf','Content-Type':'application/pdf'},data:document});
  assert.equal(upload.status(),201,await upload.text());
  await save(owner,await state(owner),s=>{const e=s.entries.find(e=>e.id==='KJD-001');e.fileId=fileId;e.fileName='uji.pdf';e.status='Menunggu Persetujuan';});
  const download=await peer.get(`/api/bpbd/files/${fileId}`);assert.equal(download.status(),200);assert.deepEqual(await download.body(),document);
  assert.equal((await other.get(`/api/bpbd/files/${fileId}`)).status(),403);
  assert.equal((await testPool.query('SELECT octet_length(content)::int AS size FROM bpbd_files WHERE id=$1',[fileId])).rows[0].size,document.length);
});
test('Registration uses server identity and pending accounts cannot create operational data', async () => {
  const ctx=await context();
  const registration=await ctx.post('/api/bpbd/register',{data:{name:'Peneliti Integrasi',email:'integration@contoh.test',institution:'Kampus Uji',purpose:'Pengujian alur penelitian',password:'PenelitiUji123!',consent:true}});
  assert.equal(registration.status(),201,await registration.text());
  const snapshot=await state(ctx);assert.equal(snapshot.store.users[0].status,'Menunggu Persetujuan');assert.equal(snapshot.store.entries.length,0);
  await save(ctx,snapshot,s=>{s.users[0].status='Aktif';},403);
  const registeredId=snapshot.userId;
  const beforeHash=(await testPool.query('SELECT password_hash FROM bpbd_users WHERE id=$1',[registeredId])).rows[0].password_hash;
  const admin=await login('adm@bpbd.example');
  await save(admin,await state(admin),s=>{s.users.find(u=>u.id===registeredId).status='Aktif';});
  assert.equal((await state(ctx)).store.users[0].status,'Aktif');
  assert.equal((await testPool.query('SELECT password_hash FROM bpbd_users WHERE id=$1',[registeredId])).rows[0].password_hash,beforeHash);
  await ctx.post('/api/bpbd/logout');assert.equal((await ctx.get('/api/bpbd/state')).status(),401);
});
test('Browser workflows use PostgreSQL, including login, forms, import, reports and research', { timeout: 360000 }, async () => {
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{env:{...environment,PLAYWRIGHT_BASE_URL:baseURL},stdio:['ignore','pipe','pipe'],windowsHide:true});
    let log='';
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;process.stdout.write(chunk);});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Browser tests failed (${code}). ${log.slice(-12000)}`)));
  });
});
