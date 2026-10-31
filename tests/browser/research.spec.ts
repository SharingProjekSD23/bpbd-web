import { Pool } from 'pg';
import { readStore, writeStore } from '../../lib/server/repository';
import { requestedResearchEntries } from '../../lib/bpbd/model';
import { test, expect, type Page } from './fixtures';

async function login(page: Page, email: string) {
  await page.request.post('/api/bpbd/logout',{headers:{'X-BPBD-Request':'1'}});
  await page.goto('/masuk');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill('BPBDdemo2026!');
  const submitted=page.waitForResponse(r=>r.url().endsWith('/api/bpbd/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  expect((await submitted).status()).toBe(200);
  await expect(page.getByRole('button',{name:'Menu akun',exact:true})).toBeVisible();
}

test('research navigation, examples and simplified details match the revision',async({page})=>{
  await login(page,'nadia@peneliti.example');
  await expect(page.getByRole('heading',{name:'Beranda Peneliti',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ajukan Permohonan',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Permohonan Data',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Show Data',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Show Data',exact:true})).toBeVisible();
  const examples=page.locator('.panel').filter({has:page.locator('table')});
  await expect(examples).toHaveCount(13);
  for(const table of await page.locator('table').all()) await expect(table.locator('tbody tr')).toHaveCount(5);
  await page.goto('/peneliti/permohonan/RSET-001');
  await expect(page.getByRole('heading',{name:'Kajian kerentanan banjir di Kecamatan Genuk',exact:true})).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Jadwal & akses'})).toBeVisible();
});

test('sending a research request automatically validates every matching row without manual checkboxes',async({page})=>{
  await login(page,'nadia@peneliti.example');
  await page.goto('/peneliti/permohonan/baru');
  await page.locator('#research-title').fill('Permohonan validasi otomatis');
  await page.locator('#research-purpose').fill('Menguji validasi otomatis seluruh data sesuai cakupan.');
  await page.locator('label').filter({hasText:'Kejadian Bencana'}).getByRole('checkbox').check();
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button',{name:'Tinjau Permohonan',exact:true}).click();
  await page.getByRole('button',{name:'Kirim Permohonan',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Permohonan validasi otomatis',exact:true})).toBeVisible();
  await expect(page.getByText(/baris data telah divalidasi otomatis pada/)).toBeVisible();
  const pool=new Pool(),client=await pool.connect();
  try {
    const {store}=await readStore(client),request=store.research.find(r=>r.title==='Permohonan validasi otomatis')!;
    const expected=requestedResearchEntries(store,request).map(e=>({id:e.id,version:e.version}));
    expect(expected.length).toBeGreaterThan(5);
    expect(request.validation?.rows).toEqual(expected);
    expect(request.status).toBe('Diajukan');
    expect(request.access).toBe('Belum Aktif');
  }finally{client.release();await pool.end();}
});

test('approved datasets preview five rows, export all rows, and validate automatically',async({page})=>{
  const pool=new Pool(),client=await pool.connect();
  let expectedRows=0;
  try {
    await client.query('BEGIN');
    const {store}=await readStore(client,true),next=structuredClone(store),r=next.research.find(r=>r.id==='RSET-001')!;
    const original=requestedResearchEntries(next,r,['kejadian'])[0];
    for(let i=0;i<10;i++)next.entries.push({...original,id:`REVIEW-${i}`,title:`Baris penelitian ${i}`});
    r.requestedGroups.push('korban');r.decisions.KL.groups.push('korban');
    for(let i=0;i<7;i++)next.entries.push({...original,id:`KORBAN-${i}`,group:'korban',unit:'orang',title:`Pendataan contoh ${i}`});
    r.decisions.KL.validatedRows=requestedResearchEntries(next,r,['kejadian','korban']).map(e=>({id:e.id,version:e.version}));
    expectedRows=r.decisions.KL.validatedRows.length;
    await writeStore(client,store,next);await client.query('COMMIT');
  } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
  await login(page,'nadia@peneliti.example');
  await page.goto('/peneliti/data');
  const preview=page.getByRole('region',{name:'Dataset Kajian kerentanan banjir di Kecamatan Genuk'});
  await expect(preview.locator('table')).toHaveCount(2);
  for(const table of await preview.locator('table').all())await expect(table.locator('tbody tr')).toHaveCount(5);
  const downloadReady=page.waitForEvent('download');
  await preview.getByRole('button',{name:'Ekspor CSV',exact:true}).click();
  const exported=await downloadReady;
  expect(exported.suggestedFilename()).toBe('RSET-001-data-disetujui.csv');
  const stream=await exported.createReadStream();
  const chunks:Buffer[]=[];
  for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const exportedCsv=Buffer.concat(chunks).toString('utf8');
  expect(exportedCsv.split('\r\n')).toHaveLength(expectedRows+1);
  expect(expectedRows).toBeGreaterThan(10);
  expect(exportedCsv).toContain('Kejadian Bencana');
  expect(exportedCsv).toContain('Korban dan Pengungsi');
  expect(exportedCsv).not.toContain('Mitigasi Bencana');
  await page.goto('/peneliti/data/RSET-001');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await login(page,'kl@bpbd.example');
  await page.goto('/riset/permohonan/RSET-001');
  await expect(page.getByRole('tab',{name:'Cakupan & keputusan'})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:/^Validasi /})).toHaveCount(0);
  await expect(page.getByText('Divalidasi otomatis',{exact:true}).first()).toBeVisible();
  await page.locator('#decision-note').fill('Cakupan disetujui dengan validasi otomatis.');
  await page.getByRole('button',{name:'Halaman berikutnya',exact:true}).first().click();
  await page.getByRole('button',{name:'Setujui Cakupan',exact:true}).click();
  await expect(page.getByText('Keputusan bidang tersimpan.',{exact:true})).toBeVisible();
  await login(page,'nadia@peneliti.example');
  await page.goto('/peneliti/data/RSET-001');
  await expect(page.locator('tbody tr')).toHaveCount(10);
});
