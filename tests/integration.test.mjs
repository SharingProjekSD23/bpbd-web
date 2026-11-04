import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import ExcelJS from 'exceljs';
import { getPool, getDb } from '../db/index.ts';
import { writeStore } from '../lib/server/repository.ts';
import { seedStore } from '../lib/bpbd/model.ts';
import { tokenHash } from '../lib/server/passwords.ts';
import { handleOperations } from '../lib/operations/api.ts';
import { modules, canReadModule, canWriteModule } from '../lib/operations/domain.ts';

const admin = new pg.Client({ database: 'postgres' });
const database = `bpbd_test_integrasi_${Date.now()}`;
const tokens = {}, seed = seedStore(); let created = false;
before(async () => {
  await admin.connect(); await admin.query(`CREATE DATABASE "${database}"`); created = true;
  process.env.PGDATABASE = database;
  await migrate(getDb(), { migrationsFolder: './drizzle/postgresql' });
  const client = await getPool().connect();
  try {
    await client.query(await readFile('sql/integrasi.sql', 'utf8')); await writeStore(client, null, seed);
    for (const role of ['ADM','PK','KL','RR','SEK','PEN']) {
      tokens[role] = randomBytes(32).toString('hex');
      await client.query("INSERT INTO bpbd_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [tokenHash(tokens[role]), seed.users.find(u=>u.role===role && u.status==='Aktif').id]);
    }
  } finally { client.release(); }
});
after(async () => {
  await getPool().end();
  if (created && /^bpbd_test_integrasi_\d+$/.test(database)) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
});
function call(role, path, method='GET', body, extra={}) {
  const headers = { ...(role ? { Cookie: `bpbd_session=${tokens[role]}` } : {}), Host: 'localhost', ...extra };
  if (method !== 'GET') headers['X-BPBD-Request']='1';
  if (body && !(body instanceof FormData)) { headers['Content-Type']='application/json'; body=JSON.stringify(body); }
  return handleOperations(new Request('http://localhost/api/operasional/'+path,{method,headers,body}));
}
async function ok(role,path,method='GET',body,status=200) {
  const response=await call(role,path,method,body); const result=await response.json();
  assert.equal(response.status,status,JSON.stringify(result));return result;
}
test('Single login protects API and assets; role scopes cover every module',async()=>{
  assert.equal((await call(null,'assets/index.html')).status,401);
  for(const role of ['ADM','PEN']) assert.equal((await call(role,'config')).status,403);
  for(const role of ['PK','KL','RR','SEK']){
    const config=await ok(role,'config');
    assert.deepEqual(config.modules.map(m=>m.id), modules.filter(m=>canReadModule(role,m.id)).map(m=>m.id));
    for(const m of modules){
      assert.equal((await call(role,'records/'+m.id)).status,canReadModule(role,m.id)?200:403);
      if(!canWriteModule(role,m.id)) assert.equal((await call(role,'records/'+m.id,'POST',{})).status,403);
    }
  }
  assert.equal((await call('KL','records/barang','POST',{nama:'bad',satuan:'unit'},{Origin:'https://foreign.example'})).status,403);
});
test('Direct operations, optimistic revisions, stock and multi-item writes are atomic',async()=>{
  await ok('KL','records/barang','POST',{id:'STOCK-1',nama:'Barang uji',satuan:'paket'},201);
  await ok('KL','records/masuk','POST',{id:'IN-1',tanggal:'2026-11-04',barang:'STOCK-1',jumlah:10,sumber:'APBD',jenis:'Penerimaan'},201);
  const bad=await call('KL','transactions','POST',{module:'keluar',rows:[{id:'OUT-A',tanggal:'2026-11-04',barang:'STOCK-1',jumlah:1,sumber:'APBD',tujuan:'Uji'},{id:'OUT-B',tanggal:'2026-11-04',barang:'STOCK-1',jumlah:10,sumber:'APBD',tujuan:'Uji'}]});
  assert.equal(bad.status,409);assert.equal((await ok('KL','records/keluar')).length,0);
  const concurrent=await Promise.all([1,2].map(i=>call('KL','records/keluar','POST',{id:'OUT-'+i,tanggal:'2026-11-04',barang:'STOCK-1',jumlah:6,sumber:'APBD',tujuan:'Uji'})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  assert.equal((await ok('PK','stock'))[0].saldo,4);
  const changed=await ok('KL','records/barang/STOCK-1','PUT',{nama:'Nama diperbarui',satuan:'paket',revision:1});assert.equal(changed.revision,2);assert.equal(changed.history[0].nama,'Barang uji');
  assert.equal((await call('KL','records/barang/STOCK-1','PUT',{nama:'stale',satuan:'paket',revision:1})).status,409);
  const before=await getPool().query('SELECT data FROM bpbd_research ORDER BY id');
  assert.deepEqual(before.rows.map(r=>r.data),[...seed.research].sort((a,b)=>a.id.localeCompare(b.id)));
});
test('Private references, history, attachments and exports stay private across menus',async()=>{
  await ok('KL','records/kejadian','POST',{id:'EVENT-1',nama:'Kejadian privat',jenis_bencana:'Banjir',tanggal:'2026-11-04'},201);
  await ok('KL','records/keluar','POST',{id:'LINKED',tanggal:'2026-11-04',barang:'STOCK-1',jumlah:1,sumber:'APBD',tujuan:'Uji',kejadian_id:'EVENT-1'},201);
  const row=(await ok('PK','records/keluar')).find(r=>r.id==='LINKED'); assert.equal(row.kejadian_id,undefined);
  assert.equal((await ok('SEK','records/keluar')).find(r=>r.id==='LINKED').kejadian_id,'EVENT-1');
  const csv=await call('PK','export/keluar?format=csv');assert.ok(!(await csv.text()).includes('EVENT-1'));
  assert.equal((await call('PK','records/kejadian')).status,403);
  const form=new FormData();form.set('file',new File(['%PDF-1.4\n%%EOF'],'uji.pdf',{type:'application/pdf'}));
  const upload=await ok('KL','attachments/kejadian/EVENT-1','POST',form,201);
  assert.equal((await call('PK','attachments/'+upload.id)).status,404);
  assert.equal((await call('SEK','attachments/'+upload.id)).status,200);
  assert.ok(!(await ok('PK','attachments')).some(f=>f.id===upload.id));
  const backup=await ok('PK','backup');assert.equal(backup.records.kejadian,undefined);assert.equal(backup.files.length,0);
  // Thousands of selected IDs travel in a bounded body, avoiding URL/header limits.
  const exported=await call('KL','export/kejadian','POST',{format:'csv',ids:Array(2000).fill('EVENT-1')});
  assert.equal(exported.status,200);assert.match(await exported.text(),/EVENT-1/);
  assert.equal((await call('PK','export/kejadian','POST',{format:'csv',ids:['EVENT-1']})).status,403);
});
test('CSV/XLSX preview and commit preserve IDs, reject duplicate batch and validate dates',async()=>{
  const csv='id,nama,satuan\nCSV-1,Barang CSV,dus\n';
  const form=()=>{const f=new FormData();f.set('file',new File([csv],'test.csv'));return f;};
  assert.equal((await ok('KL','import/barang/preview','POST',form())).count,1);
  assert.equal((await ok('KL','import/barang','POST',form())).saved,1);
  assert.equal((await call('KL','import/barang','POST',form())).status,409);
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Data');sheet.addRow(['id','nama','keluaran','tanggal']);
  sheet.addRow(['DOC-1','Dokumen uji',modules.find(m=>m.id==='dokumen').fields.find(f=>f.key==='keluaran').options[0],new Date('2026-11-04T00:00:00Z')]);
  const xlsx=new FormData();xlsx.set('file',new File([await book.xlsx.writeBuffer()],'test.xlsx'));
  assert.equal((await ok('SEK','import/dokumen','POST',xlsx)).saved,1);
  assert.equal((await ok('SEK','records/dokumen'))[0].tanggal,'2026-11-04');
  const bad=await call('SEK','records/dokumen','POST',{nama:'Salah',keluaran:modules.find(m=>m.id==='dokumen').fields.find(f=>f.key==='keluaran').options[0],tanggal:'2026-02-31'});assert.equal(bad.status,400);
});
